import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { Toaster } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DropdownMenuContent, DropdownMenuRoot, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiUrl, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import ExportConversationMenu from './export-conversation-menu';

const EXPORT_PATH = '/conversations/chat-1/export';

const renderMenu = () =>
    renderWithProviders(
        <>
            <DropdownMenuRoot>
                <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
                <DropdownMenuContent>
                    <ExportConversationMenu agentId="agent-1" conversationId="chat-1" title="Launch plan" />
                </DropdownMenuContent>
            </DropdownMenuRoot>
            <Toaster />
        </>,
    );

const openExportSubmenu = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Export' }));
};

describe('ExportConversationMenu', () => {
    let clickSpy: ReturnType<typeof vi.spyOn>;
    let downloads: { download: string }[];
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
        user = userEvent.setup();
        downloads = [];
        clickSpy = vi
            .spyOn(HTMLAnchorElement.prototype, 'click')
            .mockImplementation(function click(this: HTMLAnchorElement) {
                downloads.push({ download: this.download });
            });
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
    });

    afterEach(() => {
        clickSpy.mockRestore();
    });

    it('downloads the chat as markdown', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl(EXPORT_PATH), ({ request }) => {
                requestUrl = request.url;

                return HttpResponse.text('# Launch plan', { headers: { 'Content-Type': 'text/markdown' } });
            }),
        );

        renderMenu();
        await openExportSubmenu(user);
        // `user.click` does not select an item inside a Radix submenu under jsdom.
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Markdown' }));

        expect(await screen.findByText('Chat exported as Markdown')).toBeInTheDocument();
        expect(new URL(requestUrl).searchParams.get('format')).toBe('markdown');
        expect(downloads).toEqual([{ download: 'launch-plan.md' }]);
    });

    it('downloads the chat as json', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl(EXPORT_PATH), ({ request }) => {
                requestUrl = request.url;

                return HttpResponse.json({ messages: [] });
            }),
        );

        renderMenu();
        await openExportSubmenu(user);
        fireEvent.click(await screen.findByRole('menuitem', { name: 'JSON' }));

        expect(await screen.findByText('Chat exported as JSON')).toBeInTheDocument();
        expect(new URL(requestUrl).searchParams.get('format')).toBe('json');
        expect(downloads).toEqual([{ download: 'launch-plan.json' }]);
    });

    it('downloads the chat as pdf', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl(EXPORT_PATH), ({ request }) => {
                requestUrl = request.url;

                return HttpResponse.text('%PDF-1.4', { headers: { 'Content-Type': 'application/pdf' } });
            }),
        );

        renderMenu();
        await openExportSubmenu(user);
        fireEvent.click(await screen.findByRole('menuitem', { name: 'PDF' }));

        expect(await screen.findByText('Chat exported as PDF')).toBeInTheDocument();
        expect(new URL(requestUrl).searchParams.get('format')).toBe('pdf');
        expect(downloads).toEqual([{ download: 'launch-plan.pdf' }]);
    });

    it('downloads the chat as word', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl(EXPORT_PATH), ({ request }) => {
                requestUrl = request.url;

                return HttpResponse.text('docx-bytes', {
                    headers: {
                        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    },
                });
            }),
        );

        renderMenu();
        await openExportSubmenu(user);
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Word' }));

        expect(await screen.findByText('Chat exported as Word')).toBeInTheDocument();
        expect(new URL(requestUrl).searchParams.get('format')).toBe('docx');
        expect(downloads).toEqual([{ download: 'launch-plan.docx' }]);
    });

    it('shows the API message when the export is refused', async () => {
        server.use(
            http.get(apiUrl(EXPORT_PATH), () =>
                HttpResponse.json(
                    { success: false, message: 'You cannot export this chat', value: null },
                    { status: 403 },
                ),
            ),
        );

        renderMenu();
        await openExportSubmenu(user);
        // `user.click` does not select an item inside a Radix submenu under jsdom.
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Markdown' }));

        expect(await screen.findByText('You cannot export this chat')).toBeInTheDocument();
        expect(downloads).toHaveLength(0);
    });

    it('spins on the row while the file is being built', async () => {
        let releaseResponse = () => {};
        const held = new Promise<void>((resolve) => {
            releaseResponse = resolve;
        });

        server.use(
            http.get(apiUrl(EXPORT_PATH), async () => {
                await held;

                return HttpResponse.text('# Launch plan', { headers: { 'Content-Type': 'text/markdown' } });
            }),
        );

        renderMenu();
        await openExportSubmenu(user);
        // `user.click` does not select an item inside a Radix submenu under jsdom.
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Markdown' }));

        expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument();
        expect(await screen.findByRole('menuitem', { name: 'JSON' })).toHaveAttribute('data-disabled');

        releaseResponse();

        expect(await screen.findByText('Chat exported as Markdown')).toBeInTheDocument();
    });
});
