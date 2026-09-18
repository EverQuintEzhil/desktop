import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ConfirmActionTool from './confirm-action-tool';

const { isLastMessageMock } = vi.hoisted(() => ({ isLastMessageMock: vi.fn((): boolean => true) }));

vi.mock('./use-is-last-message', () => ({ useIsLastMessage: isLastMessageMock }));

interface ConfirmProps {
    args: unknown;
    result?: unknown;
    addResult: (value: unknown) => void;
    status?: { type: string };
}

const BaseConfirm = ConfirmActionTool as unknown as (props: ConfirmProps) => ReactElement;

const Confirm = ({ status = { type: 'requires-action' }, ...props }: ConfirmProps) => BaseConfirm({ status, ...props });

const ARGS = { title: 'Publish these changes?', detail: 'Everyone using the agent sees them immediately.' };

describe('ConfirmActionTool', () => {
    beforeEach(() => {
        isLastMessageMock.mockReturnValue(true);
    });

    it('renders inert once the conversation has moved past an unanswered confirmation', () => {
        isLastMessageMock.mockReturnValue(false);

        render(<Confirm args={ARGS} addResult={vi.fn()} />);

        expect(screen.getByText(/No longer active/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    });

    it('shows a placeholder until the arguments finish streaming', () => {
        render(<Confirm args={{}} addResult={vi.fn()} />);

        expect(screen.getByText('Preparing confirmation…')).toBeInTheDocument();
    });

    it('withholds the buttons while the run is still streaming, even with parseable args', () => {
        render(<Confirm args={ARGS} addResult={vi.fn()} status={{ type: 'running' }} />);

        expect(screen.getByText('Preparing confirmation…')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    });

    it('returns confirmed when the user accepts', async () => {
        const addResult = vi.fn();

        render(<Confirm args={ARGS} addResult={addResult} />);
        await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

        expect(addResult).toHaveBeenCalledWith({ confirmed: true });
        expect(screen.getByText('Confirmed')).toBeInTheDocument();
    });

    it('returns not confirmed when the user cancels', async () => {
        const addResult = vi.fn();

        render(<Confirm args={ARGS} addResult={addResult} />);
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(addResult).toHaveBeenCalledWith({ confirmed: false });
        expect(screen.getByText('Declined')).toBeInTheDocument();
    });

    it('uses the supplied button labels', () => {
        render(
            <Confirm args={{ ...ARGS, confirmLabel: 'Publish', cancelLabel: 'Keep editing' }} addResult={vi.fn()} />,
        );

        expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Keep editing' })).toBeInTheDocument();
    });

    it('renders a persisted answer without offering the buttons again', () => {
        render(<Confirm args={ARGS} result={{ confirmed: true }} addResult={vi.fn()} />);

        expect(screen.getByText('Confirmed')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    });

    it('answers only once even if a button is clicked twice', async () => {
        const addResult = vi.fn();

        render(<Confirm args={ARGS} addResult={addResult} />);

        const confirm = screen.getByRole('button', { name: 'Confirm' });

        await userEvent.click(confirm);
        await userEvent.click(confirm).catch(() => undefined);

        expect(addResult).toHaveBeenCalledTimes(1);
    });
});
