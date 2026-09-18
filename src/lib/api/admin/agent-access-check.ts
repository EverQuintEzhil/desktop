import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { z } from 'zod';

import type { ResourceApiType } from '@/types/admin';
import type { Module } from '@/utils/permissions';

import { apiClient } from '../client';
import { skillsApi, SKILLS_QUERY_KEY } from '../common/skills';
import { getApiErrorMessage } from '../get-api-error-message';

import { adminCapabilitiesApi } from './capabilities';
import { adminDataStoresApi } from './data-stores/api';
import { DATA_STORES_QUERY_KEY } from './data-stores/query-keys';
import { adminMcpsApi, MCPS_QUERY_KEY } from './mcps';
import { adminToolsApi, TOOLS_QUERY_KEY } from './tools';

// The ACL reason a principal lacks access. Nothing reads it any more: an explicit exclusion is
// no longer reported as a gap at all, which leaves `not-included` as the only value the endpoint
// can send, so the label it used to drive said the same thing on every row. Kept optional rather
// than deleted because the field is still on the wire and we agreed with the backend not to
// change the payload unilaterally -- and requiring it would drop every principal on the day it
// goes, turning the whole warning into "could not be read".
const accessStatusSchema = z.enum(['not-included', 'excluded']).optional();

const principalKindSchema = z.enum(['user', 'securityGroup']);

const capabilityKindSchema = z.enum(['skill', 'connector', 'dataStore', 'tool']);

const userCountSchema = z.number().int().nonnegative();

const principalAccessSchema = z.looseObject({
    id: z.string(),
    kind: principalKindSchema,
    name: z.string(),
    status: accessStatusSchema,
    // securityGroup only, display only: affected out of total users in the flat
    // security_group_users list, the same list a user's groups are resolved from at login.
    affectedUserCount: userCountSchema.optional(),
    totalUserCount: userCountSchema.optional(),
    // Label context only: the included security groups this user is reachable through. It never
    // decides which Info-tab row a user belongs to — the agent's own `includeUsers` does that,
    // so an endpoint that omits or over-populates this field cannot misfile anyone.
    viaSecurityGroups: z.array(z.looseObject({ id: z.string(), name: z.string() })).optional(),
});

const capabilityAccessSchema = z.looseObject({
    id: z.string(),
    name: z.string(),
    kind: capabilityKindSchema,
    principals: z.array(principalAccessSchema),
    // Whether the caller may rewrite this capability's ACL. Only the server knows its creator and
    // admins, so the endpoint should populate this; absent means unknown and the UI falls back to
    // the role check it can make locally, leaving a residual write to fail with a 403.
    // Deliberately tolerant rather than a strict boolean: this field may only widen or narrow the
    // Grant button, never delete the row it gates, so `null` from an ordinary serializer -- or any
    // other unusable value -- degrades to unknown instead of failing the whole capability.
    canGrant: z
        .unknown()
        .optional()
        .transform((value) => (typeof value === 'boolean' ? value : undefined)),
});

export type AccessPrincipalKind = z.infer<typeof principalKindSchema>;
export type CapabilityKind = z.infer<typeof capabilityKindSchema>;
export type PrincipalAccess = z.infer<typeof principalAccessSchema>;
export type CapabilityAccess = z.infer<typeof capabilityAccessSchema>;

export interface AgentAccessCheck {
    items: CapabilityAccess[];
    /** Gaps an admin has dismissed. Same shape as `items`; an item can appear in both. */
    ignoredItems: CapabilityAccess[];
    /**
     * How many elements of the response could not be read: items dropped whole, plus principals
     * dropped from an item that survived. The caller must surface this — a screen whose only job
     * is to warn cannot let a total drop look identical to "nobody is missing anything".
     */
    droppedCount: number;
}

const capabilityShellSchema = capabilityAccessSchema.extend({
    principals: z.array(z.unknown()),
});

export const CAPABILITY_MODULE: Record<CapabilityKind, Module> = {
    skill: 'skills',
    connector: 'mcps',
    dataStore: 'dataStores',
    tool: 'tools',
};

/**
 * Deliberate forward compatibility with an endpoint we own the spec for but which is not built
 * yet. All-or-nothing parsing would let one unrecognised capability kind or ACL reason blank a
 * screen whose entire job is to warn, so an element we cannot read costs its own row and nothing
 * else. An item left with no readable principals is not a gap we can describe, so it goes too.
 */
const parseItem = (raw: unknown): { item: CapabilityAccess | null; droppedCount: number } => {
    const shell = capabilityShellSchema.safeParse(raw);

    if (!shell.success) return { item: null, droppedCount: 1 };

    let droppedCount = 0;

    const principals = shell.data.principals.flatMap((rawPrincipal) => {
        const principal = principalAccessSchema.safeParse(rawPrincipal);

        if (principal.success) return [principal.data];

        droppedCount += 1;

        return [];
    });

    // An item with nothing readable left is one dropped item, not N dropped principals.
    if (principals.length === 0) return { item: null, droppedCount: 1 };

    return { item: { ...shell.data, principals }, droppedCount };
};

const parseItems = (raw: unknown[]): { items: CapabilityAccess[]; droppedCount: number } => {
    const items: CapabilityAccess[] = [];
    let droppedCount = 0;

    raw.forEach((rawItem) => {
        const parsed = parseItem(rawItem);

        droppedCount += parsed.droppedCount;

        if (parsed.item) items.push(parsed.item);
    });

    return { items, droppedCount };
};

const agentAccessCheckSchema = z
    .looseObject({
        items: z.array(z.unknown()),
        // Absent on a backend older than the ignore feature, which is not the same as "nothing
        // is ignored" only in that it must not be reported as a dropped element.
        ignoredItems: z.array(z.unknown()).optional(),
    })
    .transform((raw): AgentAccessCheck => {
        const gaps = parseItems(raw.items);
        const ignored = parseItems(raw.ignoredItems ?? []);

        return {
            items: gaps.items,
            ignoredItems: ignored.items,
            droppedCount: gaps.droppedCount + ignored.droppedCount,
        };
    });

export interface AgentAccessCheckRequest {
    userIds: string[];
    securityGroupIds: string[];
}

/**
 * The backend validator hard-caps each id list at 1000 and answers 400 above it — it does not
 * truncate. An open-to-everyone agent on a large tenant can cross that, so the request is sliced
 * rather than rejected.
 */
export const ACCESS_CHECK_IDS_LIMIT = 1000;

export interface CappedAccessCheckRequest extends AgentAccessCheckRequest {
    /**
     * True when the slice dropped ids, so the answer describes a subset. A capped request must
     * admit that the same way `droppedCount` admits a partial read — silence would let it
     * masquerade as a full answer.
     */
    isCapped: boolean;
}

export const capAccessCheckIds = (request: AgentAccessCheckRequest): CappedAccessCheckRequest => ({
    userIds: request.userIds.slice(0, ACCESS_CHECK_IDS_LIMIT),
    securityGroupIds: request.securityGroupIds.slice(0, ACCESS_CHECK_IDS_LIMIT),
    isCapped:
        request.userIds.length > ACCESS_CHECK_IDS_LIMIT || request.securityGroupIds.length > ACCESS_CHECK_IDS_LIMIT,
});

export const CAPABILITY_API_TYPE: Record<CapabilityKind, ResourceApiType> = {
    skill: 'skills',
    connector: 'mcpservers',
    dataStore: 'datastores',
    tool: 'tools',
};

const CAPABILITY_READ: Record<CapabilityKind, (itemId: string) => Promise<unknown>> = {
    skill: (itemId) => skillsApi.getById(itemId),
    connector: (itemId) => adminMcpsApi.getById(itemId),
    dataStore: (itemId) => adminDataStoresApi.getById(itemId),
    tool: (itemId) => adminToolsApi.getById(itemId),
};

const CAPABILITY_QUERY_ROOT: Record<CapabilityKind, readonly string[]> = {
    skill: SKILLS_QUERY_KEY,
    connector: MCPS_QUERY_KEY,
    dataStore: DATA_STORES_QUERY_KEY,
    tool: TOOLS_QUERY_KEY,
};

const idListSchema = z.array(z.string());
const entityListSchema = z.array(z.looseObject({ _id: z.string() }));

const aclFieldsSchema = z.looseObject({
    adminIds: idListSchema.optional(),
    admins: entityListSchema.optional(),
    includeUserIds: idListSchema.optional(),
    excludeUserIds: idListSchema.optional(),
    includeUsers: entityListSchema.optional(),
    excludeUsers: entityListSchema.optional(),
    includeSecurityGroupIds: idListSchema.optional(),
    excludeSecurityGroupIds: idListSchema.optional(),
    includeSecurityGroups: entityListSchema.optional(),
    excludeSecurityGroups: entityListSchema.optional(),
});

type AclFields = z.infer<typeof aclFieldsSchema>;

interface AclListSource {
    idsKey: 'adminIds' | 'includeUserIds' | 'excludeUserIds' | 'includeSecurityGroupIds' | 'excludeSecurityGroupIds';
    entitiesKey: 'admins' | 'includeUsers' | 'excludeUsers' | 'includeSecurityGroups' | 'excludeSecurityGroups';
}

const ACL_SOURCES: Record<AccessPrincipalKind, { include: AclListSource; exclude: AclListSource }> = {
    user: {
        include: { idsKey: 'includeUserIds', entitiesKey: 'includeUsers' },
        exclude: { idsKey: 'excludeUserIds', entitiesKey: 'excludeUsers' },
    },
    securityGroup: {
        include: { idsKey: 'includeSecurityGroupIds', entitiesKey: 'includeSecurityGroups' },
        exclude: { idsKey: 'excludeSecurityGroupIds', entitiesKey: 'excludeSecurityGroups' },
    },
};

const hasList = (raw: AclFields, source: AclListSource): boolean =>
    raw[source.idsKey] !== undefined || raw[source.entitiesKey] !== undefined;

// Whichever key actually names people wins: a resource can serialise both and leave one of them
// empty, and preferring the empty one would PUT away everybody on it.
const readList = (raw: AclFields, source: AclListSource): string[] => {
    const ids = raw[source.idsKey] ?? [];
    const entities = (raw[source.entitiesKey] ?? []).map((entity) => entity._id);

    return ids.length > 0 ? ids : entities;
};

// `null`, not `[]`, when neither key is present: a list nobody sent is unknown, and reading it as
// empty would report a restricted capability as open to everyone.
const readListOrNull = (raw: AclFields, source: AclListSource): string[] | null =>
    hasList(raw, source) ? readList(raw, source) : null;

const ADMIN_SOURCE: AclListSource = { idsKey: 'adminIds', entitiesKey: 'admins' };

export interface PrincipalAcl {
    includeIds: string[];
    excludeIds: string[];
    /** Everyone the capability names as its own admin — they reach it whatever the lists say.
     *  `null` when the payload carries no admin list, so a caller can refuse to guess. */
    adminIds: string[] | null;
    /** The other principal kind's lists, read-only. They decide whether a write that removes this
     *  principal still leaves them covered. `null` when the payload does not carry them. */
    otherIncludeIds: string[] | null;
    otherExcludeIds: string[] | null;
}

/**
 * A grant sends a full replacement array, so an absent list must fail loudly: treating it as
 * empty would wipe every other principal off the resource. Governed resources answer
 * `GET /:type/:id` with either the id array or the populated objects, so both shapes count as
 * present and are reduced to ids.
 */
const aclSchemaFor = (principalKind: AccessPrincipalKind) => {
    const { include, exclude } = ACL_SOURCES[principalKind];
    const other = ACL_SOURCES[principalKind === 'user' ? 'securityGroup' : 'user'];

    return aclFieldsSchema
        .refine((raw) => hasList(raw, include), { message: `Missing ${include.idsKey} or ${include.entitiesKey}` })
        .refine((raw) => hasList(raw, exclude), { message: `Missing ${exclude.idsKey} or ${exclude.entitiesKey}` })
        .transform((raw): PrincipalAcl => ({
            includeIds: readList(raw, include),
            excludeIds: readList(raw, exclude),
            adminIds: readListOrNull(raw, ADMIN_SOURCE),
            otherIncludeIds: readListOrNull(raw, other.include),
            otherExcludeIds: readListOrNull(raw, other.exclude),
        }));
};

export const adminAgentAccessCheckApi = {
    async check(agentId: string, body: AgentAccessCheckRequest): Promise<AgentAccessCheck> {
        const raw = await apiClient.post<unknown, AgentAccessCheckRequest>(`/agents/${agentId}/access-check`, body);

        return agentAccessCheckSchema.parse(raw);
    },

    /**
     * The human wording belongs here rather than at the toast: `getApiErrorMessage` returns a
     * plain `Error`'s own `message`, and a `ZodError`'s message is a JSON dump of its issues, so
     * letting the schema error escape this module would put that dump in front of an admin. The
     * refine's own text stays as developer detail on `cause`.
     */
    async readAcl(kind: CapabilityKind, itemId: string, principalKind: AccessPrincipalKind): Promise<PrincipalAcl> {
        const raw = await CAPABILITY_READ[kind](itemId);
        const parsed = aclSchemaFor(principalKind).safeParse(raw);

        if (!parsed.success) {
            throw new Error('Could not read who currently has access, so nothing was changed.', {
                cause: parsed.error,
            });
        }

        return parsed.data;
    },
};

export const CAPABILITY_ACL_QUERY_KEY = ['admin', 'capability-acl'] as const;

/**
 * One capability's access lists, read only so a menu can tell whether an action would change
 * anything. Kept briefly rather than fetched per open, so a menu reopened seconds later does not
 * pay for the round trip twice — every write invalidates the key, which is what keeps it honest.
 */
export function useCapabilityAclQuery(params: {
    kind: CapabilityKind;
    itemId: string;
    principalKind: AccessPrincipalKind;
    enabled: boolean;
}) {
    const { kind, itemId, principalKind, enabled } = params;

    return useQuery({
        queryKey: [...CAPABILITY_ACL_QUERY_KEY, kind, itemId, principalKind],
        queryFn: () => adminAgentAccessCheckApi.readAcl(kind, itemId, principalKind),
        enabled,
        staleTime: 30_000,
        retry: false,
    });
}

export const AGENT_ACCESS_CHECK_QUERY_KEY = ['admin', 'agent-access-check'] as const;

export interface AgentAccessCheckQueryParams extends AgentAccessCheckRequest {
    agentId: string;
    /** Ids of the agent's skills, connectors, data stores and tools, so the check re-runs when they change. */
    capabilitySignature: string;
    enabled: boolean;
}

export function useAgentAccessCheckQuery(params: AgentAccessCheckQueryParams) {
    const { agentId, userIds, securityGroupIds, capabilitySignature, enabled } = params;

    return useQuery({
        queryKey: [...AGENT_ACCESS_CHECK_QUERY_KEY, agentId, userIds, securityGroupIds, capabilitySignature],
        queryFn: () => adminAgentAccessCheckApi.check(agentId, { userIds, securityGroupIds }),
        enabled,
        // The endpoint is not deployed everywhere yet. A missing route must fail once and stay
        // silent rather than burn three backoff rounds on every visit to the Info tab.
        retry: false,
    });
}

/**
 * `clear` withdraws both halves of the pair — the row goes back to whatever the runtime decides.
 * `unblock` withdraws only the exclusion and leaves any include standing, which is a different
 * outcome for a principal who is both included and excluded: `unblock` gives them access back,
 * `clear` leaves them undecided.
 */
export type AccessActionMode = 'grant' | 'revoke' | 'clear' | 'unblock';

/** The lists as they will stand once the write lands. */
export type PlannedAcl = Omit<PrincipalAcl, 'includeIds' | 'excludeIds'> & {
    includeIds: string[];
    excludeIds: string[];
};

export interface SetCapabilityAccessVariables {
    mode: AccessActionMode;
    kind: CapabilityKind;
    itemId: string;
    itemName: string;
    principalKind: AccessPrincipalKind;
    principalIds: string[];
    /** Fires between the ACL read and the write, so a caller can show the outcome before the
     *  request round-trips instead of guessing it from the mode alone. */
    onPlanned?: (planned: PlannedAcl) => void;
}

const withoutIds = (ids: string[], removed: string[]): string[] => ids.filter((id) => !removed.includes(id));

const withIds = (ids: string[], added: string[]): string[] => [...ids, ...added.filter((id) => !ids.includes(id))];

const WRITE_TIMEOUT_MS = 30_000;

/**
 * Every write below is a read-modify-write of a full replacement array, so two in flight against
 * the same record each build on the same pre-write read and the later one silently undoes the
 * earlier. That is true per record, never across records, so the queue is keyed: writes sharing a
 * key run one at a time, writes under different keys run together. Module-scoped on purpose — a
 * batch in one screen and a single action in another are exactly the pair that interleaves.
 */
const writeQueues = new Map<string, Promise<unknown>>();

/** One capability's ACL. Two writes to it must not overlap; two capabilities may. */
export const capabilityWriteKey = (kind: CapabilityKind, itemId: string): string => `capability:${kind}:${itemId}`;

/** The agent record itself: every agent PUT replaces the same lists, so they all share one key. */
export const agentWriteKey = (agentId: string): string => `agent:${agentId}`;

/** One dismissal row, keyed by everything the route keys it by, so unrelated rows do not queue. */
export const ignoreWriteKey = (variables: Omit<SetAccessIgnoreVariables, 'ignored'>): string =>
    `ignore:${variables.agentId}:${variables.capabilityKind}:${variables.capabilityId}:${variables.principalKind}:${variables.principalId}`;

/**
 * Releases the caller after the deadline so one hung request cannot disable every button for the
 * life of the page — axios has no default timeout. It cannot abort the request, so the queue keeps
 * waiting for the real one: an abandoned PUT that lands late must not be read around.
 */
export const enqueueWrite = <T>(key: string, write: () => Promise<T>): Promise<T> => {
    let inFlight: Promise<T> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const next = (writeQueues.get(key) ?? Promise.resolve()).then(() => {
        inFlight = write();

        return Promise.race([
            inFlight,
            new Promise<never>((_resolve, reject) => {
                timer = setTimeout(
                    () => reject(new Error('The change is taking too long. Reload to see whether it saved.')),
                    WRITE_TIMEOUT_MS,
                );
            }),
        ]).finally(() => clearTimeout(timer));
    });

    const tail = next.catch(() => undefined).then(() => inFlight?.catch(() => undefined));

    writeQueues.set(key, tail);
    // Dropped once its chain drains, or the map would keep one settled promise per capability
    // touched for the life of the page. Only if nothing has queued behind it since.
    void tail.finally(() => {
        if (writeQueues.get(key) === tail) writeQueues.delete(key);
    });

    return next;
};

/**
 * Moves one kind of principal between a capability's include and exclude lists. Both directions
 * write the pair, never one half: an exclusion outranks an inclusion on every governed resource,
 * so granting without clearing the exclusion leaves the principal locked out, and revoking
 * without clearing the inclusion leaves them let in. Only the pair for the principal kind being
 * changed is sent; the other pair is a full replacement we have no business rewriting.
 */
export function useSetCapabilityAccessMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            mode,
            kind,
            itemId,
            itemName,
            principalKind,
            principalIds,
            onPlanned,
        }: SetCapabilityAccessVariables) =>
            enqueueWrite(capabilityWriteKey(kind, itemId), async () => {
                const acl = await adminAgentAccessCheckApi.readAcl(kind, itemId, principalKind);
                const { include, exclude } = ACL_SOURCES[principalKind];

                try {
                    const includeIds = (() => {
                        if (mode === 'grant') return withIds(acl.includeIds, principalIds);
                        // Unblock is not `clear`: it removes the exclusion and nothing else.
                        if (mode === 'unblock') return acl.includeIds;

                        return withoutIds(acl.includeIds, principalIds);
                    })();

                    const excludeIds =
                        mode === 'revoke'
                            ? withIds(acl.excludeIds, principalIds)
                            : withoutIds(acl.excludeIds, principalIds);

                    onPlanned?.({
                        includeIds,
                        excludeIds,
                        adminIds: acl.adminIds,
                        otherIncludeIds: acl.otherIncludeIds,
                        otherExcludeIds: acl.otherExcludeIds,
                    });

                    return await adminCapabilitiesApi.update(CAPABILITY_API_TYPE[kind], itemId, {
                        [include.idsKey]: includeIds,
                        [exclude.idsKey]: excludeIds,
                    });
                } catch (error) {
                    // Ownership of a capability is enforced server-side and is not in the gap payload,
                    // so a developer who did not create this one only finds out here. Say what to do
                    // rather than leaving the raw rejection to reach the toast.
                    if (isAxiosError(error) && error.response?.status === 403) {
                        // A tenant-policy refusal carries its own instruction, which beats ours; our
                        // sentence is the fallback for a 403 that says nothing useful.
                        const fallback = `You do not have permission to change access for ${itemName}. Ask an owner or admin.`;

                        throw new Error(getApiErrorMessage(error, fallback), { cause: error });
                    }

                    throw error;
                }
            }),
        // The access check is deliberately NOT invalidated here: which rows still warn is the
        // caller's question, and `useAccessActions` refetches it once per action -- after the
        // ignore route too, which never reaches this mutation at all.
        onSuccess: (_result, { kind, itemId }) => {
            const root = CAPABILITY_QUERY_ROOT[kind];

            return Promise.all([
                queryClient.invalidateQueries({ queryKey: [...root, 'list'] }),
                queryClient.invalidateQueries({ queryKey: [...root, 'detail', itemId], exact: true }),
            ]);
        },
    });
}

export interface SetAccessIgnoreVariables {
    agentId: string;
    capabilityKind: CapabilityKind;
    capabilityId: string;
    principalKind: AccessPrincipalKind;
    principalId: string;
    ignored: boolean;
}

/**
 * Records that an admin has decided one principal's gap on one capability needs no action. It
 * writes nothing to any ACL, so it changes what the page reports and never what anyone can
 * reach. Scoped to the agent: dismissing a shared tool here leaves another agent warning.
 *
 * The route validates its body strictly and is a toggle, so `ignored: false` is the un-ignore
 * and a double click is safe. Same batching contract as the ACL writes above -- the caller
 * refreshes the access check once, after the batch.
 */
export function useSetAccessIgnoreMutation() {
    return useMutation({
        mutationFn: (variables: SetAccessIgnoreVariables) => {
            const { agentId, ...body } = variables;

            return enqueueWrite(ignoreWriteKey(variables), () =>
                apiClient.put<{ ignored: boolean }, Omit<SetAccessIgnoreVariables, 'agentId'>>(
                    `/agents/${agentId}/access-ignores`,
                    body,
                ),
            );
        },
    });
}
