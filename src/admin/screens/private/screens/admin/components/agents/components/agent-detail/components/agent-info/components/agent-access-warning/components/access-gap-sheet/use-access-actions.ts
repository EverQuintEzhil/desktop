import { useCallback } from 'react';
import { toast } from 'sonner';

import type { AgentAccessItemState } from '@/lib/api/admin/agent-access';
import type { AccessPrincipalKind, CapabilityKind, PlannedAcl } from '@/lib/api/admin/agent-access-check';
import { useSetAccessIgnoreMutation, useSetCapabilityAccessMutation } from '@/lib/api/admin/agent-access-check';
import {
    accessBatchSuccessMessage,
    accessErrorMessage,
    accessFailureMessage,
    accessSuccessMessage,
    batchFailure,
    runAccessBatch,
    useAccessCacheWrites,
} from '@/lib/api/admin/agent-access-writes';

import { predictState, unchangedNotice, unchangedReason } from '../../../../../agent-access/access-coverage';
import type { ItemAccessState } from '../../use-agent-access-gaps';

import type { ActionPrincipal } from './types';

/**
 * The three decisions an admin can record about one gap, plus the undo for the third. Grant and
 * revoke rewrite the capability's ACL and so change what the principal can reach; ignore only
 * records that the gap needs no action and leaves every ACL untouched.
 */
export type AccessAction = 'grant' | 'revoke' | 'ignore' | 'unignore' | 'clear' | 'unblock';

export interface AccessActionTarget {
    action: AccessAction;
    kind: CapabilityKind;
    itemId: string;
    itemName: string;
    canGrant?: boolean;
    principalKind: AccessPrincipalKind;
    /** Everyone this one write acts on: a bulk grant folds several people into one ACL write. */
    principals: ActionPrincipal[];
    /** Where the row stands now, so a removal that leaves it exactly there can say why. */
    state?: ItemAccessState;
}

export interface AccessActions {
    run: (target: AccessActionTarget) => Promise<void>;
    /** Several writes, one refresh at the end. Resolves to how many targets failed. */
    runMany: (targets: AccessActionTarget[]) => Promise<number>;
}

/** Who the write was for, in the same words the Access tab's own toolbar uses once a batch stops
 *  being about one person. */
const subjectOf = (principals: ActionPrincipal[]): string =>
    principals.length === 1 ? principals[0].name : 'these users';

/** The Access tab's own failure set, so one refusal cannot read two ways across the two screens. */
const failureMessage = (target: AccessActionTarget): string =>
    accessFailureMessage(target.action, subjectOf(target.principals), target.itemName);

/** And its success set: nothing is painted before the server answers, so the toast is what tells
 *  the reader the click did anything at all. */
const successMessage = (target: AccessActionTarget): string =>
    accessSuccessMessage(target.action, subjectOf(target.principals), target.itemName);

/** The sheet's state names in the roster's, so a prediction can be compared with where the row
 *  already stands. A dismissed gap is a gap: the ignore changed no access list. */
const ROSTER_STATE: Record<ItemAccessState, AgentAccessItemState> = {
    granted: 'covered',
    missing: 'not-included',
    revoked: 'excluded',
    ignored: 'not-included',
};

const isAclAction = (action: AccessAction): action is 'grant' | 'revoke' | 'clear' | 'unblock' =>
    action === 'grant' || action === 'revoke' || action === 'clear' || action === 'unblock';

export const useAccessActions = (agentId: string): AccessActions => {
    const { run } = useAccessCacheWrites();
    const setAccessMutation = useSetCapabilityAccessMutation();
    const setIgnoreMutation = useSetAccessIgnoreMutation();

    const write = useCallback(
        async (target: AccessActionTarget) => {
            const { action, kind, itemId, itemName, principalKind, principals, state } = target;

            if (isAclAction(action)) {
                // A removal that succeeds and leaves the row exactly as it was reads as a broken
                // button, so it says which of the two reasons kept the access.
                const notices: string[] = [];
                // Only `clear` and `unblock` reach the prediction: the other two were patched
                // before the write, and repainting them here would flip the row twice.
                const onPlanned =
                    action === 'clear' || action === 'unblock'
                        ? (planned: PlannedAcl) =>
                              principals.forEach((principal) => {
                                  const next = predictState(principal, planned);

                                  if (!next) return;

                                  if (!state || next !== ROSTER_STATE[state]) return;

                                  const reason = unchangedReason(principal, planned);

                                  if (reason) notices.push(unchangedNotice(principal.name, itemName, reason));
                              })
                        : undefined;

                await setAccessMutation.mutateAsync({
                    mode: action,
                    kind,
                    itemId,
                    itemName,
                    principalKind,
                    principalIds: principals.map((principal) => principal.id),
                    onPlanned,
                });

                // Only once the write has landed: `onPlanned` runs before the request, and a
                // refusal there would leave this claiming an outcome that never happened.
                notices.forEach((notice) => toast.info(notice));

                return;
            }

            // One row per principal on a route that keys them apart, so they need no ordering.
            const { failed, firstError } = await runAccessBatch(principals, async (principal) => {
                await setIgnoreMutation.mutateAsync({
                    agentId,
                    capabilityKind: kind,
                    capabilityId: itemId,
                    principalKind,
                    principalId: principal.id,
                    ignored: action === 'ignore',
                });
            });

            if (failed.length > 0) throw firstError;
        },
        [agentId, setAccessMutation, setIgnoreMutation],
    );

    const runOne = useCallback(
        async (target: AccessActionTarget) => {
            await run(() => write(target), {
                success: successMessage(target),
                error: (error) => accessErrorMessage(error, target.itemName, failureMessage(target)),
            });
        },
        [run, write],
    );

    /**
     * Concurrent, bounded: grant and revoke read a capability's ACL before writing it back, so
     * two writes to the *same* capability would race each other's read — `enqueueWrite` keys the
     * queue on exactly that, which leaves different capabilities free to run together. Each
     * target repaints its own rows as its own read lands, rather than the batch settling at once.
     */
    const runMany = useCallback(
        async (targets: AccessActionTarget[]) => {
            let failures = 0;

            await run(
                async () => {
                    const { failed, firstError } = await runAccessBatch(targets, (target) => write(target));

                    failures = failed.length;

                    if (failed.length === 0) return;

                    // A partial failure is reported as a failure — the restore is all-or-nothing,
                    // and the refresh that follows shows what actually landed.
                    throw batchFailure(
                        failed.map((target) => target.itemName),
                        targets.length,
                        firstError,
                    );
                },
                {
                    // One toast for the batch, in the verb every target shares.
                    success:
                        targets.length === 1
                            ? successMessage(targets[0])
                            : accessBatchSuccessMessage(
                                  targets[0].action,
                                  subjectOf(targets[0].principals),
                                  targets.length,
                              ),
                    error: (error) =>
                        accessErrorMessage(
                            error,
                            targets.length === 1 ? targets[0].itemName : 'these items',
                            targets.length === 1
                                ? failureMessage(targets[0])
                                : `Could not update ${targets.length} items.`,
                        ),
                },
            );

            return failures;
        },
        [run, write],
    );

    return { run: runOne, runMany };
};
