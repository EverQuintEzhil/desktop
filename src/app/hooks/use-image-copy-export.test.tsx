import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Toaster } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw';

import useImageCopyExport, { type ExportImageFormat } from './use-image-copy-export';

/**
 * Canvas is the wall here. `exportImageAs` and the PNG conversion inside
 * `copyImage` both go through `new Image()` + `canvas.getContext('2d')`, neither
 * of which jsdom implements — a `blob:` src fires neither `onload` nor
 * `onerror`, so those promises never settle. What is honestly reachable is the
 * empty-url guard, the non-image MIME rejection and a failing download. Those
 * are what this file covers; see docs/app-testing.md § Product findings.
 */

const IMAGE_URL = 'https://files.localhost/download/photo.png';

interface HarnessProps {
    url?: string;
    name?: string;
    format?: ExportImageFormat;
}

const Harness = ({ url = IMAGE_URL, name = 'photo', format = 'png' }: HarnessProps) => {
    const { copyImage, exportImageAs, copying, exporting } = useImageCopyExport();

    return (
        <>
            <button type="button" onClick={() => copyImage(url)}>
                Copy
            </button>
            <button type="button" onClick={() => exportImageAs(url, name, format)}>
                Export
            </button>
            <span>{`copying:${String(copying)}`}</span>
            <span>{`exporting:${String(exporting)}`}</span>
            <Toaster />
        </>
    );
};

const stubBlob = (type: string) => {
    let requests = 0;

    server.use(
        http.get(IMAGE_URL, () => {
            requests += 1;

            return HttpResponse.arrayBuffer(new ArrayBuffer(8), { headers: { 'Content-Type': type } });
        }),
    );

    return () => requests;
};

let clipboardWrites: ClipboardItem[][] = [];
let consoleError: ReturnType<typeof vi.spyOn>;
let user: ReturnType<typeof userEvent.setup>;

describe('useImageCopyExport', () => {
    beforeEach(() => {
        clipboardWrites = [];
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        // `userEvent.setup()` installs its own `navigator.clipboard`, so it has to
        // run before the stub below rather than inside each test.
        user = userEvent.setup();

        Object.defineProperty(window.URL, 'createObjectURL', {
            configurable: true,
            writable: true,
            value: () => 'blob:mock',
        });
        Object.defineProperty(window.URL, 'revokeObjectURL', {
            configurable: true,
            writable: true,
            value: () => {},
        });

        // jsdom ships neither. The real ClipboardItem resolves the promise it is
        // handed, so the stub has to await it too — otherwise a rejection from
        // the PNG conversion escapes as an unhandled rejection and the catch
        // branch under test is never reached.
        Object.defineProperty(globalThis, 'ClipboardItem', {
            configurable: true,
            writable: true,
            value: class {
                items: Record<string, Promise<Blob>>;

                constructor(items: Record<string, Promise<Blob>>) {
                    this.items = items;
                }
            },
        });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                write: async (items: ClipboardItem[]) => {
                    clipboardWrites.push(items);
                    await Promise.all(
                        items.map(
                            (item) =>
                                Object.values((item as unknown as { items: Record<string, Promise<Blob>> }).items)[0],
                        ),
                    );
                },
            },
        });
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    it('does nothing when there is no image url to copy', async () => {
        const countRequests = stubBlob('image/png');

        render(<Harness url="" />);
        await user.click(screen.getByRole('button', { name: 'Copy' }));

        expect(countRequests()).toBe(0);
        expect(clipboardWrites).toHaveLength(0);
        expect(screen.getByText('copying:false')).toBeInTheDocument();
    });

    it('does nothing when there is no image url to export', async () => {
        const countRequests = stubBlob('image/png');

        render(<Harness url="" />);
        await user.click(screen.getByRole('button', { name: 'Export' }));

        expect(countRequests()).toBe(0);
        expect(screen.getByText('exporting:false')).toBeInTheDocument();
    });

    it('rejects a downloaded blob that is not an image', async () => {
        stubBlob('application/json');

        render(<Harness />);
        await user.click(screen.getByRole('button', { name: 'Copy' }));

        expect(await screen.findByText('Could not copy: invalid image')).toBeInTheDocument();
        expect(screen.getByText('copying:false')).toBeInTheDocument();
    });

    it('reports a generic failure when the copy download fails', async () => {
        server.use(http.get(IMAGE_URL, () => new HttpResponse(null, { status: 500 })));

        render(<Harness />);
        await user.click(screen.getByRole('button', { name: 'Copy' }));

        expect(await screen.findByText('Failed to copy image')).toBeInTheDocument();
        expect(screen.queryByText('Could not copy: invalid image')).not.toBeInTheDocument();
    });

    it('requests the image from the url it was given', async () => {
        let requestedUrl = '';

        server.use(
            http.get(IMAGE_URL, ({ request }) => {
                requestedUrl = request.url;

                return new HttpResponse(null, { status: 500 });
            }),
        );

        render(<Harness />);
        await user.click(screen.getByRole('button', { name: 'Export' }));

        await waitFor(() => {
            expect(requestedUrl).toBe(IMAGE_URL);
        });
    });

    it('reports a failed export download and clears the exporting flag', async () => {
        server.use(http.get(IMAGE_URL, () => new HttpResponse(null, { status: 500 })));

        render(<Harness />);
        await user.click(screen.getByRole('button', { name: 'Export' }));

        expect(await screen.findByText('Failed to export image')).toBeInTheDocument();
        expect(screen.getByText('exporting:false')).toBeInTheDocument();
    });
});
