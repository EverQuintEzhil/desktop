export const ATTACH_FAILURE_MESSAGE = 'Could not reconnect to the answer stream. Please reload the page.';

const readFailureMessage = async (response: Response): Promise<string> => {
    try {
        const payload = (await response.clone().json()) as { message?: unknown };

        if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();

        return ATTACH_FAILURE_MESSAGE;
    } catch {
        return ATTACH_FAILURE_MESSAGE;
    }
};

export const assertAttachedStream = async (response: Response): Promise<Response> => {
    if (response.status === 204) return response;

    const contentType = response.headers.get('content-type') ?? '';

    if (response.ok && contentType.includes('text/event-stream')) return response;

    throw new Error(await readFailureMessage(response));
};
