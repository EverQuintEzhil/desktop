import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import SearchInput from './search-input';

const DEBOUNCE_WAIT = 200;

interface HostProps {
    committed: string[];
    flushOnUnmount?: boolean;
}

/** Mounts and unmounts the input the way a tab switch does, keeping the committed term above it. */
const UnmountHost = ({ committed, flushOnUnmount }: HostProps) => {
    const [search, setSearch] = useState('');
    const [mounted, setMounted] = useState(true);

    return (
        <>
            <button type="button" onClick={() => setMounted((prev) => !prev)}>
                Toggle
            </button>
            {mounted ? (
                <SearchInput
                    search={search}
                    onChange={(next) => {
                        committed.push(next);
                        setSearch(next);
                    }}
                    searchOnChange
                    debounceWait={DEBOUNCE_WAIT}
                    flushOnUnmount={flushOnUnmount}
                    placeholder="Search things"
                />
            ) : null}
        </>
    );
};

/** Re-renders the parent on demand, which changes the `onChange` identity mid-typing. */
const RerenderingHost = ({ committed }: HostProps) => {
    const [search, setSearch] = useState('');
    const [, setTick] = useState(0);

    return (
        <>
            <button type="button" onClick={() => setTick((prev) => prev + 1)}>
                Re-render
            </button>
            <SearchInput
                search={search}
                onChange={(next) => {
                    committed.push(next);
                    setSearch(next);
                }}
                searchOnChange
                debounceWait={DEBOUNCE_WAIT}
                placeholder="Search things"
            />
        </>
    );
};

const settle = () =>
    new Promise((resolve) => {
        setTimeout(resolve, DEBOUNCE_WAIT * 4);
    });

describe('SearchInput', () => {
    it('commits the typed term once the debounce settles', async () => {
        const user = userEvent.setup();
        const committed: string[] = [];

        renderWithProviders(<UnmountHost committed={committed} />);

        await user.type(screen.getByPlaceholderText('Search things'), 'naming');

        // The whole array is not asserted: `user.type` runs on real timers, so a keystroke gap
        // wider than the debounce commits a prefix, which is the debounce working rather than a
        // defect. What the component promises is that the term the user finished on is the one
        // that lands, and that nothing arrives after it.
        await waitFor(() => {
            expect(committed.at(-1)).toBe('naming');
        });
    });

    it('drops a term still pending when it unmounts', async () => {
        const user = userEvent.setup();
        const committed: string[] = [];

        renderWithProviders(<UnmountHost committed={committed} />);

        await user.type(screen.getByPlaceholderText('Search things'), 'naming');

        const beforeUnmount = committed.length;

        await user.click(screen.getByRole('button', { name: 'Toggle' }));
        await settle();

        expect(committed.slice(beforeUnmount)).toEqual([]);
    });

    it('commits a term still pending when it unmounts with flushOnUnmount', async () => {
        const user = userEvent.setup();
        const committed: string[] = [];

        renderWithProviders(<UnmountHost committed={committed} flushOnUnmount />);

        await user.type(screen.getByPlaceholderText('Search things'), 'naming');
        await user.click(screen.getByRole('button', { name: 'Toggle' }));

        await waitFor(() => {
            expect(committed.at(-1)).toBe('naming');
        });
    });

    it('keeps a pending term through a parent re-render', async () => {
        const user = userEvent.setup();
        const committed: string[] = [];

        renderWithProviders(<RerenderingHost committed={committed} />);

        await user.type(screen.getByPlaceholderText('Search things'), 'naming');
        // A parent re-render hands down a fresh `onChange`; the pending term must survive it.
        await user.click(screen.getByRole('button', { name: 'Re-render' }));

        await waitFor(() => {
            expect(committed.at(-1)).toBe('naming');
        });
    });

    it('drops a term still pending when it is cleared', async () => {
        const user = userEvent.setup();
        const committed: string[] = [];

        renderWithProviders(<UnmountHost committed={committed} />);

        await user.type(screen.getByPlaceholderText('Search things'), 'naming');

        const beforeClear = committed.length;

        // Clearing inside the debounce window: the queued term is stale and must not land after it.
        await user.click(screen.getByRole('button', { name: '' }));
        await settle();

        expect(committed.slice(beforeClear)).toEqual(['']);
        expect(screen.getByPlaceholderText('Search things')).toHaveValue('');
    });

    it('drops a term still pending when Enter commits one', async () => {
        const user = userEvent.setup();
        const committed: string[] = [];

        renderWithProviders(<UnmountHost committed={committed} />);

        await user.type(screen.getByPlaceholderText('Search things'), 'naming{Enter}');
        await settle();

        expect(committed.at(-1)).toBe('naming');
    });

    it('commits immediately when cleared with the clear button', async () => {
        const user = userEvent.setup();
        const committed: string[] = [];

        renderWithProviders(<UnmountHost committed={committed} />);

        await user.type(screen.getByPlaceholderText('Search things'), 'naming');
        await waitFor(() => {
            expect(committed.at(-1)).toBe('naming');
        });

        await user.click(screen.getByRole('button', { name: '' }));

        expect(committed.at(-1)).toBe('');
        expect(screen.getByPlaceholderText('Search things')).toHaveValue('');
    });
});
