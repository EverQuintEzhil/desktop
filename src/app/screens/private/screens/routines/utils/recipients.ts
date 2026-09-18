import type { MeProfile } from '@/lib/api';
import type { UserType } from '@/types/admin';
import type { RoutineRecipient, RoutineType } from '@/types/routines';

/**
 * A person the picker can show. `email` is the empty string for a recipient read back off a
 * routine: `GET /routines` is Space-scoped, so the api projects recipients without an address
 * (see `routineRecipientSchema`). Only a candidate picked out of the user search carries one.
 */
export interface RecipientOption {
    userId: string;
    name: string;
    email: string;
    avatar?: string;
}

interface NameParts {
    first?: string | null;
    middle?: string | null;
    last?: string | null;
}

/**
 * Mirrors `userLabel` in the api's `helpers/pick.js` — first and last only, no middle — so a chip
 * names a person exactly as the rejection message about them will.
 */
export const recipientLabel = (name: NameParts | null | undefined, email: string): string =>
    [name?.first, name?.last].filter(Boolean).join(' ').trim() || email || 'Unnamed user';

export const optionFromUser = (user: UserType): RecipientOption => ({
    userId: user._id,
    name: recipientLabel(user.name, user.email ?? ''),
    email: user.email ?? '',
    avatar: user.avatar || undefined,
});

export const optionFromMe = (me: MeProfile): RecipientOption => ({
    userId: me._id,
    name: recipientLabel(me.name, me.email),
    email: me.email,
    avatar: me.avatar || undefined,
});

const optionFromRecipient = (recipient: RoutineRecipient): RecipientOption => ({
    userId: recipient.userId,
    name: recipientLabel(recipient.user?.name, ''),
    email: '',
    avatar: recipient.user?.avatar || undefined,
});

/**
 * Whether the response actually carried the list. `format_routine.js` returns the routine
 * untouched when the relation did not load, and `routineSchema` declares `recipients` optional —
 * so an ABSENT list is not an empty one. Treating the two alike would let a rename replace a real
 * list with the owner alone.
 */
export const hasProjectedRecipients = (routine: RoutineType): boolean => Array.isArray(routine.recipients);

/** The list an edit form opens with, straight off the routine response. */
export const storedRecipients = (routine: RoutineType): RecipientOption[] =>
    (routine.recipients ?? []).map(optionFromRecipient);

export const recipientIds = (options: readonly RecipientOption[]): string[] => options.map((option) => option.userId);

export const haveSameRecipients = (a: readonly RecipientOption[], b: readonly RecipientOption[]): boolean => {
    if (a.length !== b.length) return false;

    const ids = new Set(recipientIds(a));

    return b.every((option) => ids.has(option.userId));
};

/**
 * The two sentence shapes `api/schemas/Routines/helpers/assert_recipients.js` refuses a save with.
 * Matched only to decide WHERE to show the message — it is rendered exactly as the api wrote it.
 */
const RECIPIENT_REJECTIONS = [/ cannot be a recipient\.$/, /^We could not find a user for "/];

export const isRecipientRejection = (message: string): boolean =>
    RECIPIENT_REJECTIONS.some((pattern) => pattern.test(message));
