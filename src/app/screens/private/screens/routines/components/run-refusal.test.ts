import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import { CONNECTORS_PATH } from '@/app/components/routine-runs';

import { RUN_REFUSAL_CODE, runRefusalOf } from './run-refusal';

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

describe('runRefusalOf', () => {
    it('reads the connectors the api named, and offers the list as the target', () => {
        const refusal = runRefusalOf(
            axiosError(424, {
                success: false,
                code: RUN_REFUSAL_CODE,
                message: '"Microsoft 365 (PW)" and "Miro" need reconnecting before this routine can run.',
            }),
        );

        expect(refusal?.message).toBe('"Microsoft 365 (PW)" and "Miro" need reconnecting before this routine can run.');
        // The 424 carries no connector ids, so a deep link would be invented rather than read.
        expect(refusal?.action).toEqual({ kind: 'link', label: 'Open connectors', to: CONNECTORS_PATH });
    });

    it('still names a connector when the api sends no sentence', () => {
        const refusal = runRefusalOf(axiosError(424, { success: false, code: RUN_REFUSAL_CODE, message: '   ' }));

        expect(refusal?.message).toBe('Run now was refused because a connector is not connected.');
    });

    it('declines a 424 of another kind rather than offering a connector it cannot fix', () => {
        expect(runRefusalOf(axiosError(424, { success: false, code: 'SOMETHING_ELSE', message: 'Nope.' }))).toBeNull();
    });

    it('declines every other status, including the failures that are not refusals', () => {
        expect(runRefusalOf(axiosError(500, { code: RUN_REFUSAL_CODE, message: 'boom' }))).toBeNull();
        expect(runRefusalOf(axiosError(403, { message: 'Forbidden' }))).toBeNull();
        expect(runRefusalOf(new Error('offline'))).toBeNull();
        expect(runRefusalOf(null)).toBeNull();
    });
});
