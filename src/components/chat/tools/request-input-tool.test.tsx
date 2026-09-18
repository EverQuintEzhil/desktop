import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RequestInputTool from './request-input-tool';

const { isLastMessageMock } = vi.hoisted(() => ({ isLastMessageMock: vi.fn((): boolean => true) }));

vi.mock('./use-is-last-message', () => ({ useIsLastMessage: isLastMessageMock }));

interface RequestInputProps {
    args: unknown;
    result?: unknown;
    addResult: (value: unknown) => void;
    status?: { type: string };
    toolCallId?: string;
}

const BaseRequestInput = RequestInputTool as unknown as (props: RequestInputProps) => ReactElement;

const RequestInput = ({ status = { type: 'requires-action' }, toolCallId = 'call-1', ...props }: RequestInputProps) =>
    BaseRequestInput({ status, toolCallId, ...props });

const ARGS = {
    title: 'Where should the agent fetch quotes from?',
    fields: [
        {
            name: 'baseUrl',
            label: 'Base URL',
            type: 'url',
            required: true,
        },
        { name: 'notes', label: 'Notes' },
    ],
};

describe('RequestInputTool', () => {
    beforeEach(() => {
        isLastMessageMock.mockReturnValue(true);
    });

    it('renders inert once the conversation has moved past an unanswered form', () => {
        isLastMessageMock.mockReturnValue(false);
        const addResult = vi.fn();

        render(<RequestInput args={ARGS} addResult={addResult} />);

        expect(screen.getByText(/No longer active/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    });

    it('keeps an already answered form rendered as its summary in older messages', () => {
        isLastMessageMock.mockReturnValue(false);

        render(
            <RequestInput
                args={ARGS}
                result={{ values: { baseUrl: 'https://quotes.example.com' } }}
                addResult={vi.fn()}
            />,
        );

        expect(screen.getByText('https://quotes.example.com')).toBeInTheDocument();
        expect(screen.queryByText(/No longer active/)).not.toBeInTheDocument();
    });

    it('shows a placeholder until the arguments finish streaming', () => {
        render(<RequestInput args={{ title: 'Partial' }} addResult={vi.fn()} />);

        expect(screen.getByText('Preparing form…')).toBeInTheDocument();
    });

    it('withholds the form while the run is still streaming, even with parseable args', () => {
        render(<RequestInput args={ARGS} addResult={vi.fn()} status={{ type: 'running' }} />);

        expect(screen.getByText('Preparing form…')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    });

    it('blocks submission until a required field is filled', async () => {
        const addResult = vi.fn();

        render(<RequestInput args={ARGS} addResult={addResult} />);
        await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

        expect(screen.getByText('This is required.')).toBeInTheDocument();
        expect(addResult).not.toHaveBeenCalled();
    });

    it('rejects a value that is not a valid URL', async () => {
        const addResult = vi.fn();

        render(<RequestInput args={ARGS} addResult={addResult} />);
        await userEvent.type(screen.getByLabelText(/Base URL/), 'not a url');
        await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

        expect(screen.getByText('Enter a valid http or https URL.')).toBeInTheDocument();
        expect(addResult).not.toHaveBeenCalled();
    });

    it('returns trimmed values and omits the ones left blank', async () => {
        const addResult = vi.fn();

        render(<RequestInput args={ARGS} addResult={addResult} />);
        await userEvent.type(screen.getByLabelText(/Base URL/), '  https://example.com  ');
        await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

        expect(addResult).toHaveBeenCalledWith({ values: { baseUrl: 'https://example.com' } });
    });

    it('summarises what was submitted instead of leaving the fields editable', async () => {
        render(<RequestInput args={ARGS} addResult={vi.fn()} />);
        await userEvent.type(screen.getByLabelText(/Base URL/), 'https://example.com');
        await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

        expect(screen.getByText('https://example.com')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    });

    it('returns no values when the user skips the form', async () => {
        const addResult = vi.fn();

        render(<RequestInput args={ARGS} addResult={addResult} />);
        await userEvent.click(screen.getByRole('button', { name: 'Not now' }));

        expect(addResult).toHaveBeenCalledWith({ values: {}, skipped: true });
        expect(screen.getByText('Skipped — nothing was submitted.')).toBeInTheDocument();
    });

    it('rejects a number field that is not numeric', async () => {
        const addResult = vi.fn();

        render(
            <RequestInput
                args={{
                    title: 'How many?',
                    fields: [
                        {
                            name: 'count',
                            label: 'Count',
                            type: 'number',
                            required: true,
                        },
                    ],
                }}
                addResult={addResult}
            />,
        );
        await userEvent.type(screen.getByLabelText(/Count/), '12e');
        await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

        expect(addResult).not.toHaveBeenCalled();
    });
});
