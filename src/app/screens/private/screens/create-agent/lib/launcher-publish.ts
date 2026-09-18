import { adminAgentsApi } from '@/lib/api/admin/agents';
import { adminLaunchersApi } from '@/lib/api/admin/launchers';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import type { LauncherType } from '@/types/admin';

import { slugify } from './create-agent-api';

/** The subset of a launcher `GET /agents/:id?launcher=true` returns — the full row is not projected. */
export type AgentLauncher = Pick<
    LauncherType,
    '_id' | 'name' | 'urlOrSlug' | 'isPublished' | 'description' | 'sortOrder'
>;

/** Matches the API's `urlOrSlug` validator for agent launchers. */
export const LAUNCHER_SLUG_PATTERN = /^[a-z0-9-]+$/;

export const toLauncherSlug = (value: string): string => slugify(value);

export interface AgentLauncherState {
    launcher: AgentLauncher | null;
    agentName: string;
    agentDescription: string;
}

/** Without an `_id` a launcher cannot be linked to, unpublished or deleted, so it is unusable. */
const hasLauncherId = (value: unknown): value is AgentLauncher =>
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as Partial<AgentLauncher>)._id === 'string' &&
    Boolean((value as Partial<AgentLauncher>)._id);

/** A launcher without an `_id` is unusable rather than absent, so the caller must not read it as none. */
const toAgentLauncher = (value: unknown): AgentLauncher | null => {
    if (!value || typeof value !== 'object') return null;

    if (!hasLauncherId(value)) {
        throw new Error('Agent launcher came back without an id');
    }

    return value;
};

export const fetchAgentLauncherState = async (agentId: string): Promise<AgentLauncherState> => {
    const agent = await adminAgentsApi.getBySlugOrId(agentId, { params: { launcher: true } });

    return {
        launcher: toAgentLauncher(agent.launcher),
        agentName: agent.name ?? '',
        agentDescription: agent.description ?? '',
    };
};

export interface CreateLauncherForAgentInput {
    agentId: string;
    name: string;
    urlOrSlug: string;
    description?: string;
    sortOrder?: number;
}

/**
 * The user lists are deliberately omitted: with none supplied the API copies the agent's own
 * include/exclude lists onto the new launcher, which is what keeps the AMP-232 two-way sync true
 * from the first second rather than only after a later manual edit.
 */
export const createLauncherForAgent = async (input: CreateLauncherForAgentInput): Promise<AgentLauncher | null> => {
    const created = await adminLaunchersApi.create({
        type: 'agent',
        agentId: input.agentId,
        name: input.name,
        urlOrSlug: input.urlOrSlug,
        description: input.description ?? '',
        isPublished: true,
        // Omitted rather than defaulted to 0: the body is a `strictObject`, and letting the column
        // default apply is not the same as this control asserting a position.
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
    });

    // Only an identified launcher is worth caching: anything else and the caller refetches rather
    // than caching a row it could not later unpublish (`PUT /launchers/undefined`).
    return hasLauncherId(created) ? created : null;
};

/**
 * Hides the launcher from home without destroying it: the row keeps its name, URL and inherited
 * user list, so republishing is one call back rather than minting a new launcher on a freed URL.
 */
export const setLauncherPublished = async (launcherId: string, isPublished: boolean): Promise<void> => {
    await adminLaunchersApi.update(launcherId, { isPublished });
};

/**
 * Every key is optional because the route is a partial update and only the changed ones are sent.
 * `urlOrSlug` especially: `PUT /launchers/:id` copies it onto the *agent's* slug, so resending an
 * unchanged value read from a stale cache silently reverts the agent's public URL.
 */
export type LauncherEdit = Partial<{
    name: string;
    description: string;
    urlOrSlug: string;
    sortOrder: number;
    isPublished: boolean;
}>;

export const updateLauncher = async (launcherId: string, edit: LauncherEdit): Promise<void> => {
    await adminLaunchersApi.update(launcherId, edit);
};

export const deleteLauncher = async (launcherId: string): Promise<void> => {
    await adminLaunchersApi.delete(launcherId);
};

export interface AgentLauncherLookup {
    launcherId: string | null;
    /** A failed read means "unknown", not "no launcher" — the caller has to say so rather than assume. */
    readFailed: boolean;
}

/**
 * Resolved before the agent is deleted: `GET /agents/:id` no longer returns a soft-deleted agent,
 * so the link from agent to launcher is unreadable once the delete has gone through.
 */
export const findLauncherIdForAgent = async (agentId: string): Promise<AgentLauncherLookup> => {
    try {
        const { launcher } = await fetchAgentLauncherState(agentId);

        return { launcherId: launcher?._id ?? null, readFailed: false };
    } catch {
        return { launcherId: null, readFailed: true };
    }
};

/**
 * Deleting an agent only soft-deletes the agent row, so its launcher would survive as a tile
 * pointing at nothing. The failure is reported but never rethrown: `DELETE /agents/:id` also
 * admits the agent's creator, while `DELETE /launchers/:id` is admin/owner only, so a creator
 * deleting their own agent can legitimately fail here — and that must not undo a delete that
 * already went through.
 */
export const deleteLauncherById = async (launcherId: string): Promise<boolean> => {
    try {
        await adminLaunchersApi.delete(launcherId);

        return true;
    } catch {
        return false;
    }
};

const SLUG_TAKEN_MESSAGE = 'There is already a launcher with url/slug';
const AGENT_TAKEN_MESSAGE = 'There is already a launcher with agentId';

export interface LauncherCreateError {
    field: 'name' | 'urlOrSlug' | 'sortOrder' | 'form';
    message: string;
    /** The agent turned out to already have a launcher, so the cached launcher state is wrong. */
    alreadyPublished?: boolean;
}

/**
 * The create route rejects a duplicate slug with its own wording, but the update route has no
 * pre-check: it falls through to the unique index and comes back as a generic conflict. Both mean
 * the same thing to the person typing, so both land on the URL field rather than as a form error
 * they cannot act on.
 */
const CONFLICT_MESSAGE = 'Something with these details already exists';

export const toLauncherCreateError = (
    error: unknown,
    fallback = 'Something went wrong. Please try again.',
): LauncherCreateError => {
    const message = getApiErrorMessage(error, fallback);

    if (message.includes(SLUG_TAKEN_MESSAGE) || message.includes(CONFLICT_MESSAGE)) {
        return { field: 'urlOrSlug', message: 'That URL is already taken. Try another.' };
    }

    if (message.includes(AGENT_TAKEN_MESSAGE)) {
        return { field: 'form', message: 'This agent already has a launcher.', alreadyPublished: true };
    }

    return { field: 'form', message };
};

export interface LauncherFields {
    name: string;
    urlOrSlug: string;
    /** Blank is a real state, not zero: it means "leave the server's value alone". */
    sortOrder: string;
}

/**
 * Shared by both dialogs so the create and edit forms cannot drift on what a valid launcher is.
 * Returns the parsed values, or the first field that is wrong.
 */
export const validateLauncherFields = (
    fields: LauncherFields,
): { error: LauncherCreateError } | { error: null; name: string; urlOrSlug: string; sortOrder?: number } => {
    const name = fields.name.trim();
    const urlOrSlug = fields.urlOrSlug.trim().toLowerCase();
    const rawSortOrder = fields.sortOrder.trim();

    if (!name) {
        return { error: { field: 'name', message: 'Give the launcher a name.' } };
    }

    if (!LAUNCHER_SLUG_PATTERN.test(urlOrSlug)) {
        return { error: { field: 'urlOrSlug', message: 'Use lowercase letters, numbers and dashes only.' } };
    }

    if (rawSortOrder && !Number.isInteger(Number(rawSortOrder))) {
        return { error: { field: 'sortOrder', message: 'Use a whole number, or leave it blank.' } };
    }

    return { error: null, name, urlOrSlug, sortOrder: rawSortOrder ? Number(rawSortOrder) : undefined };
};
