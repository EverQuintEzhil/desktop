import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { envelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import { BuilderRequestsProvider } from './builder-requests-context';
import CollectDataStoreCredentialsTool from './credentials-tool';

const { isLastMessageMock } = vi.hoisted(() => ({ isLastMessageMock: vi.fn((): boolean => true) }));

vi.mock('@/components/chat/tools/use-is-last-message', () => ({ useIsLastMessage: isLastMessageMock }));

interface ToolProps {
    args: unknown;
    result?: unknown;
    addResult: (value: unknown) => void;
    toolCallId: string;
    status?: { type: string };
}

const BaseTool = CollectDataStoreCredentialsTool as unknown as (props: ToolProps) => React.ReactElement;

const Tool = ({ status = { type: 'requires-action' }, ...props }: ToolProps) => BaseTool({ status, ...props });

// Matches the default fixture user, so the store reads as created by the current user.
const CURRENT_USER_ID = 'user-1';

const stubDataStore = (overrides: Record<string, unknown> = {}) => {
    server.use(
        respond('get', '/datastores/ds-1', () =>
            envelope({
                _id: 'ds-1',
                name: 'Sales DB',
                provider: 'postgresql',
                refName: 'sales_db',
                creator: { _id: CURRENT_USER_ID },
                ...overrides,
            }),
        ),
    );
};

const renderTool = (args: unknown = { dataStoreId: 'ds-1', reason: 'It needs read access.' }) => {
    const addResult = vi.fn();
    const onBeforeOpen = vi.fn();

    const view = renderWithProviders(
        <BuilderRequestsProvider onBeforeOpen={onBeforeOpen}>
            <Tool args={args} addResult={addResult} toolCallId="call-1" />
        </BuilderRequestsProvider>,
    );

    return { ...view, addResult, onBeforeOpen };
};

describe('CollectDataStoreCredentialsTool', () => {
    beforeEach(() => {
        isLastMessageMock.mockReturnValue(true);
    });

    it('renders inert without fetching once the conversation has moved past an unanswered card', () => {
        isLastMessageMock.mockReturnValue(false);

        const storeFetch = vi.fn();

        server.use(
            respond('get', '/datastores/ds-1', () => {
                storeFetch();

                return envelope({ _id: 'ds-1', name: 'Sales DB', provider: 'postgresql' });
            }),
        );

        renderTool({ dataStoreId: 'ds-1', dataStoreName: 'Sales DB' });

        expect(screen.getByText(/No longer active/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Not now' })).not.toBeInTheDocument();
        expect(storeFetch).not.toHaveBeenCalled();
    });

    it('shows a placeholder until the arguments finish streaming', () => {
        renderTool({});

        expect(screen.getByText('Preparing…')).toBeInTheDocument();
    });

    it('does not fetch or render the form while the run is still streaming', () => {
        renderWithProviders(
            <BuilderRequestsProvider>
                <Tool
                    args={{ dataStoreId: 'ds-1' }}
                    addResult={vi.fn()}
                    toolCallId="call-1"
                    status={{ type: 'running' }}
                />
            </BuilderRequestsProvider>,
        );

        expect(screen.getByText('Preparing…')).toBeInTheDocument();
    });

    it('names the data store and explains why', async () => {
        stubDataStore();
        renderTool();

        expect(await screen.findByText('Connect Sales DB')).toBeInTheDocument();
        expect(screen.getByText('It needs read access.')).toBeInTheDocument();
    });

    it('renders the provider connection fields inline rather than behind a modal', async () => {
        stubDataStore();
        renderTool();

        expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('loads collection options through the wizard endpoint of the loaded store', async () => {
        stubDataStore({ provider: 'mongodb' });

        const wizardHit = vi.fn();

        server.use(
            respond('post', '/datastores/wizard/ds-1/collections', () => {
                wizardHit();

                return envelope({ values: ['orders'], page_info: { page: 0, total_pages: 1 } });
            }),
        );

        renderTool();

        const [uriInput] = await screen.findAllByRole('textbox');

        await userEvent.type(uriInput, 'mongodb://localhost:27017');
        await userEvent.click(screen.getByRole('combobox'));

        await waitFor(() => {
            expect(wizardHit).toHaveBeenCalled();
        });
        expect(await screen.findByText('orders')).toBeInTheDocument();
    });

    it('promises the values never reach the chat', async () => {
        stubDataStore();
        renderTool();

        expect(
            await screen.findByText(/never enters the chat|Nothing you type here enters the chat/),
        ).toBeInTheDocument();
    });

    it('offers the full editor only as a fallback alongside the inline form', async () => {
        stubDataStore();
        const { onBeforeOpen } = renderTool();

        await userEvent.click(await screen.findByRole('button', { name: /Open full editor/ }));

        expect(onBeforeOpen).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 'data-store-credentials',
                dataStoreId: 'ds-1',
            }),
        );
    });

    it('declines when the user skips', async () => {
        stubDataStore();
        const { addResult } = renderTool();

        await userEvent.click(await screen.findByRole('button', { name: 'Not now' }));

        expect(addResult).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }));
    });

    it('falls back to the full editor when the user did not create the store', async () => {
        stubDataStore({ creator: { _id: 'someone-else' } });
        renderTool();

        expect(await screen.findByText(/Only the person who created this data store/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });

    it('explains that an uploads-only store has no connection to fill in', async () => {
        stubDataStore({ provider: 'files' });
        renderTool();

        expect(await screen.findByText(/no connection to fill in/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });

    it('falls back to the data store page for a provider with no connection schema', async () => {
        stubDataStore({ provider: 'some-future-provider' });
        renderTool();

        expect(await screen.findByText('This data store type has no inline connection form.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });

    it('renders the links editor inline for a weblinks store', async () => {
        stubDataStore({ provider: 'weblinks' });
        renderTool();

        expect(await screen.findByText(/Editing Web Links/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('https://example.com')).toBeInTheDocument();
    });

    it('saves weblinks through the real endpoint and reports the count, never the links', async () => {
        stubDataStore({ provider: 'weblinks', name: 'Docs Site' });
        server.use(
            respond('put', '/datastores/wizard/ds-1/weblinks', () => envelope({ _id: 'ds-1', name: 'Docs Site' })),
        );
        const { addResult } = renderTool();

        await userEvent.type(await screen.findByPlaceholderText('https://example.com'), 'https://docs.example.com');
        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() => {
            expect(addResult).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
        });

        const receipt = addResult.mock.calls[0][0] as { summary: string };

        expect(receipt.summary).toContain('1 web link');
        expect(receipt.summary).not.toContain('docs.example.com');
    });

    it('declines a weblinks store when the user cancels the editor', async () => {
        stubDataStore({ provider: 'weblinks' });
        const { addResult } = renderTool();

        await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

        expect(addResult).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }));
    });

    it('reports a load failure without offering the form', async () => {
        server.use(respond('get', '/datastores/ds-1', () => new Response(null, { status: 500 })));
        renderTool();

        await waitFor(() => {
            expect(screen.getByText('That data store could not be loaded.')).toBeInTheDocument();
        });
    });

    it('renders a persisted receipt instead of the form', async () => {
        const addResult = vi.fn();

        renderWithProviders(
            <BuilderRequestsProvider>
                <Tool
                    args={{ dataStoreId: 'ds-1', dataStoreName: 'Sales DB' }}
                    result={{ status: 'completed', summary: 'Connection saved earlier.' }}
                    addResult={addResult}
                    toolCallId="call-1"
                />
            </BuilderRequestsProvider>,
        );

        expect(await screen.findByText('Connection saved earlier.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });
});
