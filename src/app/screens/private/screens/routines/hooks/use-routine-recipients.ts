import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, type RefObject } from 'react';

import { accountApi, ME_QUERY_KEY } from '@/lib/api';
import { adminUsersApi, USERS_LIST_QUERY_KEY } from '@/lib/api/admin/users';
import type { RoutineType } from '@/types/routines';

import { optionFromMe, optionFromUser, type RecipientOption } from '../utils/recipients';

interface Params {
    routine?: RoutineType | null;
    /** Only fetched while the picker is on screen, so a form set to Notification: Off stays quiet. */
    enabled: boolean;
    /** False when the response never carried the list: an unknown list must not be stood in for. */
    canSeed: boolean;
    recipients: RecipientOption[];
    setRecipients: (value: RecipientOption[]) => void;
    /** Advanced alongside the seeded value, or an untouched picker would look edited on save. */
    loadedRecipientsRef: RefObject<RecipientOption[]>;
}

/**
 * Resolves who a routine's runs are emailed and pre-fills the owner.
 *
 * The api stores an EMPTY list to mean "the owner alone" (`assert_recipients.js`), so a routine
 * with no stored rows — every routine created before AMP-600 — has to be shown as its owner, or
 * adding one colleague would send a list that silently drops them. The owner is resolved by id
 * rather than assumed to be the viewer: a Space member can edit someone else's routine.
 */
export const useRoutineRecipients = ({
    routine,
    enabled,
    canSeed,
    recipients,
    setRecipients,
    loadedRecipientsRef,
}: Params): { currentUserId?: string } => {
    const hasSeededRef = useRef(false);
    const needsOwner = enabled && canSeed && recipients.length === 0 && !hasSeededRef.current;
    const ownerId = routine?.creatorId ?? null;

    const { data: me } = useQuery({
        queryKey: ME_QUERY_KEY,
        queryFn: () => accountApi.getMe(),
        enabled,
    });

    // Only for a stored list that came back empty, and only on an edit form: while creating, the
    // owner is the viewer, whom `/users/me` already answers.
    const { data: owner } = useQuery({
        queryKey: [...USERS_LIST_QUERY_KEY, 'detail', ownerId],
        queryFn: () => adminUsersApi.getById(ownerId as string),
        enabled: needsOwner && Boolean(routine) && Boolean(ownerId),
        staleTime: 5 * 60_000,
    });

    const resolveSeed = (): RecipientOption | null => {
        if (routine) return owner ? optionFromUser(owner) : null;

        return me ? optionFromMe(me) : null;
    };

    const seed = resolveSeed();

    useEffect(() => {
        if (!needsOwner || !seed) return;
        hasSeededRef.current = true;

        const seeded = [seed];

        // The stored empty list ALREADY means this person, so the baseline moves with the value:
        // a save that only renames the routine must still send no `recipients` key.
        loadedRecipientsRef.current = seeded;
        setRecipients(seeded);
    }, [needsOwner, seed, setRecipients, loadedRecipientsRef]);

    return { currentUserId: me?._id };
};
