import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BuilderRequestsProvider, useBuilderRequestHost, useBuilderRequests } from './builder-requests-context';
import type { BuilderRequest, BuilderRequestReceipt } from './types';

const requestOf = (id: string, kind: BuilderRequest['kind'] = 'data-store-credentials'): BuilderRequest => ({
    id,
    kind,
});

const Raiser = ({ onSettled }: { onSettled: (receipt: BuilderRequestReceipt) => void }) => {
    const { open } = useBuilderRequests();

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    void open(requestOf('a')).then(onSettled);
                }}
            >
                raise a
            </button>
            <button
                type="button"
                onClick={() => {
                    void open(requestOf('b')).then(onSettled);
                }}
            >
                raise b
            </button>
        </>
    );
};

const Answerer = () => {
    const { pending, resolve, cancel } = useBuilderRequestHost();

    if (!pending) return <span>idle</span>;

    return (
        <>
            <span>{`pending ${pending.id}`}</span>
            <button type="button" onClick={() => resolve({ status: 'completed', summary: 'Saved.' })}>
                answer
            </button>
            <button type="button" onClick={() => cancel()}>
                dismiss
            </button>
        </>
    );
};

const renderHarness = (onSettled = vi.fn(), onBeforeOpen?: (request: BuilderRequest) => void) => {
    render(
        <BuilderRequestsProvider onBeforeOpen={onBeforeOpen}>
            <Raiser onSettled={onSettled} />
            <Answerer />
        </BuilderRequestsProvider>,
    );

    return onSettled;
};

describe('BuilderRequestsProvider', () => {
    it('starts with nothing pending', () => {
        renderHarness();

        expect(screen.getByText('idle')).toBeInTheDocument();
    });

    it('exposes the raised request to the answering surface', async () => {
        renderHarness();
        await userEvent.click(screen.getByRole('button', { name: 'raise a' }));

        expect(screen.getByText('pending a')).toBeInTheDocument();
    });

    it('settles the raiser with the receipt and clears the pending request', async () => {
        const onSettled = renderHarness();

        await userEvent.click(screen.getByRole('button', { name: 'raise a' }));
        await userEvent.click(screen.getByRole('button', { name: 'answer' }));

        expect(onSettled).toHaveBeenCalledWith({ status: 'completed', summary: 'Saved.' });
        expect(screen.getByText('idle')).toBeInTheDocument();
    });

    it('settles as cancelled when the surface is dismissed', async () => {
        const onSettled = renderHarness();

        await userEvent.click(screen.getByRole('button', { name: 'raise a' }));
        await userEvent.click(screen.getByRole('button', { name: 'dismiss' }));

        expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }));
    });

    it('cancels the first request when a second supersedes it', async () => {
        const onSettled = renderHarness();

        await userEvent.click(screen.getByRole('button', { name: 'raise a' }));
        await userEvent.click(screen.getByRole('button', { name: 'raise b' }));

        expect(onSettled).toHaveBeenCalledWith({ status: 'cancelled', summary: 'Superseded by another request.' });
        expect(screen.getByText('pending b')).toBeInTheDocument();
    });

    it('runs onBeforeOpen with the request before it goes pending', async () => {
        const onBeforeOpen = vi.fn();

        renderHarness(vi.fn(), onBeforeOpen);
        await userEvent.click(screen.getByRole('button', { name: 'raise a' }));

        expect(onBeforeOpen).toHaveBeenCalledWith(requestOf('a'));
    });

    it('answers with a no-op host when no provider is mounted', () => {
        render(<Answerer />);

        expect(screen.getByText('idle')).toBeInTheDocument();
    });

    it('throws for a raiser rendered outside the provider', () => {
        const onError = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => render(<Raiser onSettled={vi.fn()} />)).toThrow(/BuilderRequestsProvider/);

        onError.mockRestore();
    });
});
