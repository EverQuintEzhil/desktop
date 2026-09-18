import { ATTACH_FAILURE_MESSAGE, assertAttachedStream } from './attach-response';

export interface AttachAbortHandle {
    abortInternal: () => void;
}

const withAbortCutOff = (response: Response, signal: AbortSignal): Response => {
    if (!response.body) return response;

    return new Response(response.body.pipeThrough(new TransformStream(), { signal }), response);
};

export const createAttachFetch =
    (baseFetch: typeof fetch, controllerRef: { current: AttachAbortHandle | null }) =>
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        controllerRef.current?.abortInternal();

        const controller = new AbortController();
        // A forwarded caller abort must stay an AbortError so the SDK reports isAbort;
        // only our own teardown resolves as "nothing to resume".
        let isInternalAbort = false;
        const handle: AttachAbortHandle = {
            abortInternal: () => {
                isInternalAbort = true;
                controller.abort();
            },
        };

        controllerRef.current = handle;

        if (init?.signal) {
            if (init.signal.aborted) controller.abort();
            else init.signal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        try {
            const attached = await assertAttachedStream(await baseFetch(input, { ...init, signal: controller.signal }));

            return withAbortCutOff(attached, controller.signal);
        } catch (error) {
            if (isInternalAbort) return new Response(null, { status: 204 });

            // A rejection carries no response, so assertAttachedStream never ran and
            // raw transport text would reach the thread.
            if (error instanceof TypeError) throw new Error(ATTACH_FAILURE_MESSAGE);

            throw error;
        }
    };
