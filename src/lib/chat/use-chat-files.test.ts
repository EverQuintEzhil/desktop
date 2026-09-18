import { act, renderHook, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_FILE_SIZE_BYTES } from './file-upload-utils';
import { useChatFiles } from './use-chat-files';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const FILES_BASE_URL = 'https://files.test';

const uploadResponse = (name: string): Response =>
    ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
            Promise.resolve({
                value: {
                    values: [
                        {
                            _id: 'uploaded-1',
                            name,
                            location: `chat/${name}`,
                            url: `${FILES_BASE_URL}/${name}`,
                        },
                    ],
                },
            }),
    }) as unknown as Response;

/**
 * jsdom implements neither object-URL method, and `addFiles` mints a local preview URL for
 * every attachment before the upload starts.
 */
const stubObjectUrls = () => {
    let counter = 0;

    URL.createObjectURL = vi.fn(() => `blob:preview-${++counter}`);
    URL.revokeObjectURL = vi.fn();
};

const textFile = (name: string, contents = 'hello') => new File([contents], name, { type: 'text/plain' });

const oversizedFile = (name: string): File => {
    const file = new File(['x'], name, { type: 'text/plain' });

    Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE_BYTES + 1 });

    return file;
};

const renderChatFiles = (uploadFetch: typeof fetch) =>
    renderHook(() =>
        useChatFiles({
            agentId: 'agent-1',
            filesBaseUrl: FILES_BASE_URL,
            fetch: uploadFetch,
        }),
    );

describe('useChatFiles addFiles', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        stubObjectUrls();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('appends the file and starts an upload', async () => {
        const uploadFetch = vi.fn(() => Promise.resolve(uploadResponse('notes.txt'))) as unknown as typeof fetch;
        const { result } = renderChatFiles(uploadFetch);

        act(() => {
            result.current.addFiles([textFile('notes.txt')]);
        });

        expect(result.current.files).toHaveLength(1);
        expect(result.current.files[0].name).toBe('notes.txt');
        expect(result.current.files[0].isUploading).toBe(true);
        expect(result.current.isUploading).toBe(true);
        expect(uploadFetch).toHaveBeenCalledTimes(1);
        expect(vi.mocked(uploadFetch).mock.calls[0][0]).toBe(`${FILES_BASE_URL}/upload`);

        await waitFor(() => expect(result.current.files[0].isUploading).toBe(false));
        expect(result.current.files[0]._id).toBe('uploaded-1');
        expect(result.current.files[0].uploadProgress).toBe(100);
        expect(result.current.isUploading).toBe(false);
    });

    it('drops a file over the 50MB cap and toasts', () => {
        const uploadFetch = vi.fn() as unknown as typeof fetch;
        const { result } = renderChatFiles(uploadFetch);

        act(() => {
            result.current.addFiles([oversizedFile('huge.txt')]);
        });

        expect(result.current.files).toHaveLength(0);
        expect(uploadFetch).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith('File exceeds 50MB limit.', expect.anything());
    });

    it('keeps the valid file when a batch mixes a valid and an oversized file', async () => {
        const uploadFetch = vi.fn(() => Promise.resolve(uploadResponse('notes.txt'))) as unknown as typeof fetch;
        const { result } = renderChatFiles(uploadFetch);

        act(() => {
            result.current.addFiles([textFile('notes.txt'), oversizedFile('huge.txt')]);
        });

        expect(result.current.files.map((f) => f.name)).toEqual(['notes.txt']);
        expect(toast.error).toHaveBeenCalledWith('File exceeds 50MB limit.', expect.anything());
        expect(uploadFetch).toHaveBeenCalledTimes(1);

        await waitFor(() => expect(result.current.files[0].isUploading).toBe(false));
    });

    it('pluralises the toast when several files exceed the cap', () => {
        const { result } = renderChatFiles(vi.fn() as unknown as typeof fetch);

        act(() => {
            result.current.addFiles([oversizedFile('a.txt'), oversizedFile('b.txt')]);
        });

        expect(toast.error).toHaveBeenCalledWith('2 file(s) exceed 50MB limit', expect.anything());
    });

    it('keeps the File so a failed upload can be retried', async () => {
        const uploadFetch = vi
            .fn()
            .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' })
            .mockResolvedValueOnce(uploadResponse('notes.txt')) as unknown as typeof fetch;
        const { result } = renderChatFiles(uploadFetch);

        act(() => {
            result.current.addFiles([textFile('notes.txt')]);
        });

        await waitFor(() => expect(result.current.files[0].uploadError).toBe(true));

        const { tempId } = result.current.files[0];

        act(() => {
            result.current.retryUpload(tempId!);
        });

        // `retryUpload` clears `uploadError` before the request resolves, so the settled
        // upload has to be awaited on `_id` rather than on the error flag.
        await waitFor(() => expect(result.current.files[0]._id).toBe('uploaded-1'));
        expect(result.current.files[0].uploadError).toBe(false);
        expect(uploadFetch).toHaveBeenCalledTimes(2);
    });
});
