import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { filesUrl, server } from '@/test/msw';

import LibraryPreviewContent from './library-preview-content';

// CodeMirror 6 pulls ~13 legacy language modes and needs real layout measurement;
// the component under test only forwards `value` and `theme` to it.
vi.mock('@uiw/react-codemirror', () => ({
    default: ({ value }: { value: string }) => <div data-testid="code-mirror">{value}</div>,
}));

// Producing a real docx in a test is not worth it; DocPreview's own suite covers the parse.
vi.mock('mammoth', () => ({
    default: {
        convertToHtml: async () => ({ value: '<h1>Converted document</h1>', messages: [] }),
    },
}));

const TEXT_URL = filesUrl('/download/notes.txt');
const IMAGE_URL = filesUrl('/download/photo.png');
const PDF_URL = filesUrl('/download/brief.pdf');

const ERROR_MESSAGE = 'Unable to load this file. Please try downloading it instead.';

const stubText = (body: string) => {
    server.use(http.get(TEXT_URL, () => HttpResponse.text(body)));
};

const stubBinary = (url: string, contentType: string) => {
    server.use(
        http.get(url, () =>
            HttpResponse.arrayBuffer(new ArrayBuffer(8), {
                headers: { 'Content-Type': contentType },
            }),
        ),
    );
};

describe('LibraryPreviewContent', () => {
    beforeEach(() => {
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        // The component logs the axios failure before rendering its error state.
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('loading chrome', () => {
        it('uses the dark lightbox chrome when no theme is passed', () => {
            stubText('hello');

            render(<LibraryPreviewContent item={{ name: 'notes.txt', url: TEXT_URL }} />);

            expect(screen.getByRole('status').parentElement).toHaveClass('text-white');
            expect(screen.getByRole('status').parentElement).not.toHaveClass('text-muted-foreground');
        });

        it('follows the app appearance when theme is auto', () => {
            stubText('hello');

            render(<LibraryPreviewContent item={{ name: 'notes.txt', url: TEXT_URL }} theme="auto" />);

            expect(screen.getByRole('status').parentElement).toHaveClass('text-muted-foreground');
            expect(screen.getByRole('status').parentElement).not.toHaveClass('text-white');
        });
    });

    describe('onContentLoaded', () => {
        it('reports the fetched body for a text file', async () => {
            stubText('the pasted body text');

            const onContentLoaded = vi.fn();

            render(
                <LibraryPreviewContent item={{ name: 'notes.txt', url: TEXT_URL }} onContentLoaded={onContentLoaded} />,
            );

            await waitFor(() => expect(onContentLoaded).toHaveBeenCalledWith('the pasted body text'));
            expect(await screen.findByTestId('code-mirror')).toHaveTextContent('the pasted body text');
        });

        it('does not report anything for an image, which takes the blob path', async () => {
            stubBinary(IMAGE_URL, 'image/png');

            const onContentLoaded = vi.fn();

            render(
                <LibraryPreviewContent
                    item={{ name: 'photo.png', url: IMAGE_URL }}
                    onContentLoaded={onContentLoaded}
                />,
            );

            expect(await screen.findByAltText('photo.png')).toHaveAttribute('src', 'blob:preview');
            expect(onContentLoaded).not.toHaveBeenCalled();
        });

        it('does not report anything for a pdf, which takes the blob path', async () => {
            stubBinary(PDF_URL, 'application/pdf');

            const onContentLoaded = vi.fn();

            render(
                <LibraryPreviewContent item={{ name: 'brief.pdf', url: PDF_URL }} onContentLoaded={onContentLoaded} />,
            );

            await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
            expect(screen.getByTitle('brief.pdf')).toBeInTheDocument();
            expect(onContentLoaded).not.toHaveBeenCalled();
        });

        it('is not invoked after the component unmounts mid-fetch', async () => {
            let release = () => {};
            const held = new Promise<void>((resolve) => {
                release = resolve;
            });

            server.use(
                http.get(TEXT_URL, async () => {
                    await held;

                    return HttpResponse.text('late body');
                }),
            );

            const onContentLoaded = vi.fn();

            const { unmount } = render(
                <LibraryPreviewContent item={{ name: 'notes.txt', url: TEXT_URL }} onContentLoaded={onContentLoaded} />,
            );

            unmount();
            release();

            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });

            expect(onContentLoaded).not.toHaveBeenCalled();
        });
    });

    describe('error state', () => {
        it('renders the message in the dark chrome by default', async () => {
            server.use(http.get(TEXT_URL, () => HttpResponse.json({ message: 'nope' }, { status: 500 })));

            render(<LibraryPreviewContent item={{ name: 'notes.txt', url: TEXT_URL }} />);

            expect(await screen.findByText(ERROR_MESSAGE)).toHaveClass('text-white/80');
        });

        it('renders the message in the app appearance when theme is auto', async () => {
            server.use(http.get(TEXT_URL, () => HttpResponse.json({ message: 'nope' }, { status: 500 })));

            render(<LibraryPreviewContent item={{ name: 'notes.txt', url: TEXT_URL }} theme="auto" />);

            const message = await screen.findByText(ERROR_MESSAGE);

            expect(message).toHaveClass('text-muted-foreground');
            expect(message).not.toHaveClass('text-white/80');
        });

        it('reports a failed binary fetch through the same error state', async () => {
            server.use(http.get(IMAGE_URL, () => HttpResponse.json({ message: 'nope' }, { status: 500 })));

            render(<LibraryPreviewContent item={{ name: 'photo.png', url: IMAGE_URL }} />);

            expect(await screen.findByText(ERROR_MESSAGE)).toBeInTheDocument();
            expect(screen.queryByAltText('photo.png')).not.toBeInTheDocument();
        });
    });

    describe('loadFile override', () => {
        it('reads text through loadFile instead of uiAxios', async () => {
            server.use(
                http.get(TEXT_URL, () => {
                    throw new Error('uiAxios must not be used when loadFile is provided');
                }),
            );

            const loadFile = vi.fn().mockResolvedValue(new Blob(['body via transport']));

            render(<LibraryPreviewContent item={{ name: 'notes.txt', url: TEXT_URL }} loadFile={loadFile} />);

            expect(await screen.findByTestId('code-mirror')).toHaveTextContent('body via transport');
            expect(loadFile).toHaveBeenCalledWith(TEXT_URL, expect.any(AbortSignal));
        });

        it('reads a binary through loadFile instead of uiAxios', async () => {
            server.use(
                http.get(IMAGE_URL, () => {
                    throw new Error('uiAxios must not be used when loadFile is provided');
                }),
            );

            const loadFile = vi.fn().mockResolvedValue(new Blob([new ArrayBuffer(8)], { type: 'image/png' }));

            render(<LibraryPreviewContent item={{ name: 'photo.png', url: IMAGE_URL }} loadFile={loadFile} />);

            expect(await screen.findByAltText('photo.png')).toHaveAttribute('src', 'blob:preview');
            expect(loadFile).toHaveBeenCalledTimes(1);
        });

        it('shows the shared error state when loadFile rejects', async () => {
            const loadFile = vi.fn().mockRejectedValue(new Error('401'));

            render(<LibraryPreviewContent item={{ name: 'notes.txt', url: TEXT_URL }} loadFile={loadFile} />);

            expect(await screen.findByText(ERROR_MESSAGE)).toBeInTheDocument();
        });

        it('falls back to uiAxios when loadFile is absent', async () => {
            const handler = vi.fn(() => HttpResponse.text('body via axios'));

            server.use(http.get(TEXT_URL, handler));

            render(<LibraryPreviewContent item={{ name: 'notes.txt', url: TEXT_URL }} />);

            expect(await screen.findByTestId('code-mirror')).toHaveTextContent('body via axios');
            expect(handler).toHaveBeenCalled();
        });
    });

    it('stays on the loading state when the item carries no url', () => {
        render(<LibraryPreviewContent item={{ name: 'notes.txt' }} />);

        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    describe('parsed previews', () => {
        it('renders a csv as a table and reports its text', async () => {
            const onContentLoaded = vi.fn();
            const loadFile = vi.fn().mockResolvedValue(new Blob(['name,age\nada,36'], { type: 'text/csv' }));

            render(
                <LibraryPreviewContent
                    item={{ name: 'people.csv', url: filesUrl('/download/people.csv') }}
                    loadFile={loadFile}
                    onContentLoaded={onContentLoaded}
                />,
            );

            expect(await screen.findByRole('cell', { name: 'ada' })).toBeInTheDocument();
            await waitFor(() => expect(onContentLoaded).toHaveBeenCalledWith(expect.stringContaining('ada,36')));
        });

        it('routes a docx to the document preview', async () => {
            const loadFile = vi.fn().mockResolvedValue(new Blob(['docx bytes']));

            render(
                <LibraryPreviewContent
                    item={{ name: 'report.docx', url: filesUrl('/download/report.docx') }}
                    loadFile={loadFile}
                />,
            );

            expect(await screen.findByRole('heading', { name: 'Converted document' })).toBeInTheDocument();
        });

        it('refuses to parse an oversized spreadsheet and offers the download fallback', async () => {
            const onDownload = vi.fn();
            const loadFile = vi
                .fn()
                .mockResolvedValue(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'text/csv' }));

            render(
                <LibraryPreviewContent
                    item={{ name: 'activity-log.csv', url: filesUrl('/download/activity-log.csv') }}
                    loadFile={loadFile}
                    onDownload={onDownload}
                />,
            );

            expect(
                await screen.findByText(
                    'activity-log.csv (5.0 MB) is too large to preview. Please try downloading it instead.',
                ),
            ).toBeInTheDocument();

            screen.getByRole('button', { name: 'Download' }).click();
            expect(onDownload).toHaveBeenCalledTimes(1);
        });
    });
});
