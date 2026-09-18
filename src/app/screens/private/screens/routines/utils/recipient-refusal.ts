import { isAxiosError } from 'axios';

import type { RecipientOption } from './recipients';

/** The api's code for a recipient who cannot see the routine's Space — fixable from this dialog. */
export const RECIPIENT_NO_SPACE_ACCESS_CODE = 'RECIPIENT_NO_SPACE_ACCESS';

/** The api's code for a recipient who cannot see the routine's agent — no fix reachable from here. */
export const RECIPIENT_NO_AGENT_ACCESS_CODE = 'RECIPIENT_NO_AGENT_ACCESS';

const REFUSAL_STATUS = 400;

/** Matches `${userLabel} cannot see the "${space}" space, so they cannot be a recipient.` */
const SPACE_MESSAGE_PATTERN = /^(.+) cannot see the "(.+)" space, so they cannot be a recipient\.$/;

export interface RecipientSpaceRefusal {
    message: string;
    projectId: string;
    spaceName: string;
    recipient: RecipientOption;
}

/**
 * Only `RECIPIENT_NO_SPACE_ACCESS` is actionable here: an admin can add the named person to the
 * routine's Space (`POST /projects/:projectId/members`) without leaving the dialog.
 * `RECIPIENT_NO_AGENT_ACCESS` has no fix reachable from a routine dialog, so it is left to render
 * as the plain sentence the same way it always has — this helper returns `null` for it.
 *
 * The api's error middleware forwards only `{ success, value, message, code }` for this refusal —
 * no ids — so the refused person is found by matching the message's name against the picker's own
 * list. That match is safe because `recipientLabel` mirrors the api's `userLabel` byte for byte
 * (first + last, no middle), which is the whole point of that mirroring (see recipients.ts) —
 * EXCEPT when two picked recipients share that exact label (two people named "John Smith", say).
 * The api's own query gives no guarantee it refused the one that happens to sit first in this
 * list, so a same-label match is ambiguous rather than merely unlikely: acting on it could add
 * the wrong person to the Space. Declared unmatched in that case, same as no match at all.
 */
export const recipientSpaceRefusalOf = (
    error: unknown,
    projectId: string | null | undefined,
    recipients: readonly RecipientOption[],
): RecipientSpaceRefusal | null => {
    if (!projectId) return null;
    if (!isAxiosError(error) || error.response?.status !== REFUSAL_STATUS) return null;

    const data = error.response?.data;

    if (!data || typeof data !== 'object') return null;

    const { code, message } = data as { code?: unknown; message?: unknown };

    if (code !== RECIPIENT_NO_SPACE_ACCESS_CODE || typeof message !== 'string') return null;

    const match = SPACE_MESSAGE_PATTERN.exec(message);

    if (!match) return null;

    const [, name, spaceName] = match;
    const matches = recipients.filter((option) => option.name === name);

    if (matches.length !== 1) return null;

    return { message, projectId, spaceName, recipient: matches[0] };
};
