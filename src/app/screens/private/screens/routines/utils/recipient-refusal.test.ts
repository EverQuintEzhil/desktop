import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import { RECIPIENT_NO_SPACE_ACCESS_CODE, recipientSpaceRefusalOf } from './recipient-refusal';
import type { RecipientOption } from './recipients';

const axiosError = (status: number, data: unknown): AxiosError => {
    const error = new AxiosError('Request failed');

    error.response = {
        status,
        statusText: '',
        data,
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
    };

    return error;
};

const option = (userId: string, name: string): RecipientOption => ({ userId, name, email: `${userId}@ex.com` });

describe('recipientSpaceRefusalOf', () => {
    it('matches the refused name against the picker list and reads the space name off the sentence', () => {
        const refusal = recipientSpaceRefusalOf(
            axiosError(400, {
                success: false,
                code: RECIPIENT_NO_SPACE_ACCESS_CODE,
                message: 'Grace Hopper cannot see the "Test Space 1" space, so they cannot be a recipient.',
            }),
            'project-1',
            [option('u1', 'Ada Lovelace'), option('u2', 'Grace Hopper')],
        );

        expect(refusal).toEqual({
            message: 'Grace Hopper cannot see the "Test Space 1" space, so they cannot be a recipient.',
            projectId: 'project-1',
            spaceName: 'Test Space 1',
            recipient: option('u2', 'Grace Hopper'),
        });
    });

    it('declines when there is no projectId to add the person to', () => {
        expect(
            recipientSpaceRefusalOf(
                axiosError(400, {
                    code: RECIPIENT_NO_SPACE_ACCESS_CODE,
                    message: 'Grace Hopper cannot see the "Test Space 1" space, so they cannot be a recipient.',
                }),
                null,
                [option('u2', 'Grace Hopper')],
            ),
        ).toBeNull();
    });

    it('declines the agent-access code, which has no fix reachable from this dialog', () => {
        expect(
            recipientSpaceRefusalOf(
                axiosError(400, {
                    code: 'RECIPIENT_NO_AGENT_ACCESS',
                    message: 'Grace Hopper cannot see the "Research" agent, so they cannot be a recipient.',
                }),
                'project-1',
                [option('u2', 'Grace Hopper')],
            ),
        ).toBeNull();
    });

    it('declines when the refused name matches more than one recipient, rather than guessing which', () => {
        expect(
            recipientSpaceRefusalOf(
                axiosError(400, {
                    code: RECIPIENT_NO_SPACE_ACCESS_CODE,
                    message: 'Grace Hopper cannot see the "Test Space 1" space, so they cannot be a recipient.',
                }),
                'project-1',
                [option('u1', 'Grace Hopper'), option('u2', 'Grace Hopper')],
            ),
        ).toBeNull();
    });

    it('declines when the named person is not in the current picker list', () => {
        expect(
            recipientSpaceRefusalOf(
                axiosError(400, {
                    code: RECIPIENT_NO_SPACE_ACCESS_CODE,
                    message: 'Someone Else cannot see the "Test Space 1" space, so they cannot be a recipient.',
                }),
                'project-1',
                [option('u2', 'Grace Hopper')],
            ),
        ).toBeNull();
    });

    it('declines every other status and shape, including non-refusals', () => {
        expect(
            recipientSpaceRefusalOf(
                axiosError(500, { code: RECIPIENT_NO_SPACE_ACCESS_CODE, message: 'boom' }),
                'p1',
                [],
            ),
        ).toBeNull();
        expect(recipientSpaceRefusalOf(axiosError(403, { message: 'Forbidden' }), 'p1', [])).toBeNull();
        expect(recipientSpaceRefusalOf(new Error('offline'), 'p1', [])).toBeNull();
        expect(recipientSpaceRefusalOf(null, 'p1', [])).toBeNull();
    });
});
