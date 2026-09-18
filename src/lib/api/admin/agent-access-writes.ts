import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { getApiErrorMessage } from '../get-api-error-message';

import { AGENT_ACCESS_ROSTER_QUERY_KEY } from './agent-access';
import { AGENT_ACCESS_CHECK_QUERY_KEY, CAPABILITY_ACL_QUERY_KEY } from './agent-access-check';

/** What a write says once it is over. Both are required: a confirmed write that stays silent is
 *  indistinguishable from a click that never registered. */
export interface AccessWriteMessages {
    success: string;
    error: (error: unknown) => string;
}

export interface AccessCacheWrites {
    /** Write, refresh, then say so — resolves false when the write failed and nothing changed. */
    run: (write: () => Promise<void>, messages: AccessWriteMessages) => Promise<boolean>;
    invalidateAccess: () => Promise<unknown>;
}

/**
 * How many writes of one batch are allowed on the wire at once. `enqueueWrite` already keeps two
 * writes to the same capability apart, so this only bounds how many *different* capabilities a
 * batch opens at once: high enough that a dozen rows settle together, low enough that a 40-row
 * selection does not open 40 sockets against an api that answers each with a read and a write.
 */
export const ACCESS_BATCH_CONCURRENCY = 6;

export interface AccessBatchResult<T> {
    /** The entries whose write threw, in the order they were given. */
    failed: T[];
    /** The first failure by that same order, so a whole-batch failure can rethrow the real cause. */
    firstError: unknown;
}

/**
 * Runs `task` over every entry with a bounded number in flight. It never rejects: one refusal
 * must not abort the rest of the batch, so failures are collected and handed back by entry.
 */
export const runAccessBatch = async <T>(
    entries: T[],
    task: (entry: T) => Promise<unknown>,
): Promise<AccessBatchResult<T>> => {
    const failures: { index: number; entry: T; error: unknown }[] = [];
    let cursor = 0;

    const worker = async () => {
        while (cursor < entries.length) {
            const index = cursor;

            cursor += 1;

            try {
                await task(entries[index]);
            } catch (error) {
                failures.push({ index, entry: entries[index], error });
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(ACCESS_BATCH_CONCURRENCY, entries.length) }, () => worker()));

    // Reported in the order the caller listed them, not the order they happened to fail in: the
    // toast names items, and a shuffled list reads as a different set of items each retry.
    failures.sort((a, b) => a.index - b.index);

    return { failed: failures.map((failure) => failure.entry), firstError: failures[0]?.error };
};

/** The six writes either access surface can attempt. Both name them the same way, so a failure on
 *  one screen cannot describe the same refusal differently from the other. */
export type AccessWriteVerb = 'grant' | 'revoke' | 'clear' | 'unblock' | 'ignore' | 'unignore';

/**
 * What a failed write says: the verb, who it was for and which capability. One wording for the
 * Access tab and the review sheet, because the same refusal reaching two screens must not read as
 * two different problems.
 */
export const accessFailureMessage = (verb: AccessWriteVerb, subject: string, itemName: string): string => {
    switch (verb) {
        case 'grant':
            return `Could not give ${subject} access to \u201C${itemName}\u201D.`;
        case 'revoke':
            return `Could not exclude ${subject} from \u201C${itemName}\u201D.`;
        case 'clear':
            return `Could not reset ${subject} on \u201C${itemName}\u201D.`;
        case 'unblock':
            return `Could not stop excluding ${subject} on \u201C${itemName}\u201D.`;
        // An ignore is about the gap, never about a list, so naming a person would misdescribe it.
        case 'ignore':
            return `Could not ignore this gap on \u201C${itemName}\u201D.`;
        case 'unignore':
            return `Could not stop ignoring this gap on \u201C${itemName}\u201D.`;
    }
};

const itemsLabel = (count: number): string => `${count} ${count === 1 ? 'item' : 'items'}`;

const gapsLabel = (count: number): string => `${count} ${count === 1 ? 'gap' : 'gaps'}`;

/**
 * What a write that landed says, in the verb the reader just clicked. A confirmed write repaints
 * from the server rather than ahead of it, so without this a grant that worked and a grant that
 * was refused look the same for as long as the refresh takes.
 */
export const accessSuccessMessage = (verb: AccessWriteVerb, subject: string, itemName: string): string => {
    switch (verb) {
        case 'grant':
            return `Granted ${subject} access to \u201C${itemName}\u201D.`;
        case 'revoke':
            return `Excluded ${subject} from \u201C${itemName}\u201D.`;
        case 'clear':
            return `Reset ${subject} on \u201C${itemName}\u201D.`;
        case 'unblock':
            return `Stopped excluding ${subject} on \u201C${itemName}\u201D.`;
        // An ignore is about the gap, never about a list, so naming a person would misdescribe it.
        case 'ignore':
            return `Ignored this gap on \u201C${itemName}\u201D.`;
        case 'unignore':
            return `Stopped ignoring this gap on \u201C${itemName}\u201D.`;
    }
};

/** The same sentence for a whole batch: one toast per batch, never one per row. */
export const accessBatchSuccessMessage = (verb: AccessWriteVerb, subject: string, count: number): string => {
    switch (verb) {
        case 'grant':
            return `Granted ${subject} access to ${itemsLabel(count)}.`;
        case 'revoke':
            return `Excluded ${subject} from ${itemsLabel(count)}.`;
        case 'clear':
            return `Reset ${subject} on ${itemsLabel(count)}.`;
        case 'unblock':
            return `Stopped excluding ${subject} on ${itemsLabel(count)}.`;
        case 'ignore':
            return `Ignored ${gapsLabel(count)}.`;
        case 'unignore':
            return `Stopped ignoring ${gapsLabel(count)}.`;
    }
};

/**
 * A refusal in the words the reader can act on: a 403 is not a broken screen, it is a right they
 * do not hold, and the api's own message wins over both when it has one.
 */
export const accessErrorMessage = (error: unknown, subject: string, fallback: string): string => {
    if (isAxiosError(error) && error.response?.status === 403) {
        return getApiErrorMessage(
            error,
            `You do not have permission to change access for ${subject}. Ask an owner or admin.`,
        );
    }

    return getApiErrorMessage(error, fallback);
};

/**
 * What a batch that only partly landed throws. Counted, because "some of it worked" is useless
 * without saying how much: a whole-batch failure rethrows the real cause instead, which carries
 * the api's own message.
 */
export const batchFailure = (failedNames: string[], total: number, firstError: unknown): Error | unknown =>
    failedNames.length === total
        ? firstError
        : new Error(
              `Could not update ${failedNames.length} of ${total} ${total === 1 ? 'item' : 'items'}: ${failedNames.join(', ')}.`,
          );

/**
 * How long the read-back after a write may take before the screen gives up waiting for it. The
 * write itself is bounded by `enqueueWrite`, but nothing bounds the GETs that follow it, and with
 * no optimistic paint a refresh stuck behind a proxy holds the spinner, the menu and the toast
 * hostage until a reload.
 */
export const ACCESS_REFRESH_TIMEOUT_MS = 15_000;

/** Resolves when the refresh does, or when it has taken too long — never rejects: the write landed
 *  either way, and only the rows are behind. */
export const withRefreshDeadline = (refresh: Promise<unknown>, timeoutMs = ACCESS_REFRESH_TIMEOUT_MS): Promise<void> =>
    new Promise((resolve) => {
        const timer = setTimeout(resolve, timeoutMs);

        void refresh
            .catch(() => undefined)
            .finally(() => {
                clearTimeout(timer);
                resolve();
            });
    });

// Module scope, because two panels mounted at once share these caches: they must also share the
// count that decides which write gets to refresh them.
let pendingWrites = 0;

/**
 * Every success line the overlapping writes have earned, held until the last of them has read the
 * rows back: only that write refreshes, so a toast fired when its own request landed would announce
 * a row the screen is not showing yet.
 */
let pendingSuccess: string[] = [];

/**
 * The write machinery both access surfaces run on: the Access tab and the Info tab's review sheet
 * read the same two queries, so they cancel, refresh and announce them the same way.
 *
 * No write paints ahead of the server. The row changes only once the request has landed and the
 * two queries have been read back, and every write says what happened — which is why the control
 * that started it has to show it is working in the meantime.
 */
export const useAccessCacheWrites = (): AccessCacheWrites => {
    const queryClient = useQueryClient();

    // The menus read this to decide whether an action would change anything; a stale copy would
    // offer the wrong verdict on the row just written, so it is refreshed after every write.
    const invalidateAcl = useCallback(
        () => queryClient.invalidateQueries({ queryKey: CAPABILITY_ACL_QUERY_KEY }),
        [queryClient],
    );

    // Both surfaces read from these two keys, so a change made on one refreshes the other without
    // either screen knowing it exists.
    const invalidateRows = useCallback(
        () =>
            Promise.all([
                queryClient.invalidateQueries({ queryKey: AGENT_ACCESS_ROSTER_QUERY_KEY }),
                queryClient.invalidateQueries({ queryKey: AGENT_ACCESS_CHECK_QUERY_KEY }),
            ]),
        [queryClient],
    );

    const invalidateAccess = useCallback(
        () => Promise.all([invalidateRows(), invalidateAcl()]),
        [invalidateAcl, invalidateRows],
    );

    // Only a query that already holds data: cancelling one still on its first load leaves it
    // pending with nothing to retrigger it, and the next refresh now waits for the whole batch.
    const cancelLoaded = useCallback(
        (queryKey: readonly string[]) =>
            queryClient.getQueriesData({ queryKey }).forEach(([key, data]) => {
                if (data !== undefined) void queryClient.cancelQueries({ queryKey: key, exact: true });
            }),
        [queryClient],
    );

    /**
     * Write, read back, then say what happened. Nothing is painted ahead of the server, so a row
     * only ever shows a state the api has confirmed — and a failure has nothing to undo.
     *
     * Only the last write standing refreshes. Clicking Grant then Exclude sends two writes; if the
     * first one's refetch landed while the second was still on the wire it would repaint the row
     * with a state the admin has already moved on from, and the row would flicker.
     *
     * Every success line waits for that one refresh, so no toast claims an outcome the rows are not
     * showing yet — and a refresh that stalls is not allowed to hold any of it, because the write
     * has landed and the caller's spinner is the only thing between the admin and a reload.
     */
    const run = useCallback(
        async (write: () => Promise<void>, messages: AccessWriteMessages): Promise<boolean> => {
            let hasLanded = false;

            // Inside the try, so a throw cannot strand the counter above zero and leave the rows
            // never refreshing again.
            try {
                pendingWrites += 1;
                // An in-flight read started before the write would land after it, holding the row
                // at the state the write just changed.
                cancelLoaded(AGENT_ACCESS_ROSTER_QUERY_KEY);
                cancelLoaded(AGENT_ACCESS_CHECK_QUERY_KEY);

                await write();

                hasLanded = true;
                pendingSuccess.push(messages.success);
            } catch (error) {
                // A refusal describes no row, so it is said at once rather than held for a refresh.
                toast.error(messages.error(error));
            } finally {
                pendingWrites -= 1;

                // Nothing else moves the rows, so every write needs them read back — and the last
                // one standing refreshes for the whole overlapping batch, then speaks for it.
                if (pendingWrites === 0) {
                    const announced = pendingSuccess;

                    pendingSuccess = [];

                    await withRefreshDeadline(invalidateAccess());
                    announced.forEach((message) => toast.success(message));
                }
            }

            return hasLanded;
        },
        [cancelLoaded, invalidateAccess],
    );

    return { run, invalidateAccess };
};
