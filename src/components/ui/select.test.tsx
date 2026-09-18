import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { installPointerCaptureShims, installScrollIntoViewShim } from '@/test/dom-shims';
import { renderWithProviders, screen } from '@/test/test-utils';

import Select, { type ComboboxOption, type PaginatedSelectData } from './select';

installPointerCaptureShims();
installScrollIntoViewShim();

type Options = Array<ComboboxOption<string>>;

// The stub in src/test/setup.ts drops the callback, so the sentinel can never be fired.
// This one keeps it, which is the only way to drive the load-more path from a test.
const observerCallbacks: IntersectionObserverCallback[] = [];

class CapturingIntersectionObserver {
    root = null;

    rootMargin = '';

    thresholds: number[] = [];

    observe = vi.fn();

    unobserve = vi.fn();

    disconnect = vi.fn();

    takeRecords = vi.fn(() => []);

    constructor(callback: IntersectionObserverCallback) {
        observerCallbacks.push(callback);
    }
}

vi.stubGlobal('IntersectionObserver', CapturingIntersectionObserver);

const fireSentinel = async () => {
    await act(async () => {
        observerCallbacks.at(-1)?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
};

// A promise the test settles by hand, so assertions can land while the fetch is
// still in flight — the exact window where the panel used to render blank.
const deferredOptions = () => {
    let settle: (options: Options) => void = () => {};
    const promise = new Promise<Options>((resolve) => {
        settle = resolve;
    });

    return { fetch: vi.fn(() => promise), settle: (options: Options) => settle(options) };
};

const openDropdown = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('combobox'));
};

describe('Select loading state', () => {
    it('shows the loading message instead of the empty text while the first page is in flight', async () => {
        const user = userEvent.setup();
        const { fetch, settle } = deferredOptions();

        renderWithProviders(<Select options={fetch} />);
        await openDropdown(user);

        expect(await screen.findByText('Loading...')).toBeInTheDocument();
        expect(screen.queryByText('No option found.')).not.toBeInTheDocument();

        settle([{ value: 'orders', label: 'orders' }]);

        expect(await screen.findByText('orders')).toBeInTheDocument();
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('holds back "No option found." until the fetch resolves with nothing', async () => {
        const user = userEvent.setup();
        const { fetch, settle } = deferredOptions();

        renderWithProviders(<Select options={fetch} />);
        await openDropdown(user);

        expect(screen.queryByText('No option found.')).not.toBeInTheDocument();

        settle([]);

        expect(await screen.findByText('No option found.')).toBeInTheDocument();
    });

    it('shows the loading message on the keystroke, before the debounced request leaves', async () => {
        const user = userEvent.setup();
        const fetch = vi.fn(() => Promise.resolve<Options>([{ value: 'orders', label: 'orders' }]));

        renderWithProviders(<Select options={fetch} allowSearch />);
        await openDropdown(user);
        expect(await screen.findByText('orders')).toBeInTheDocument();

        await user.type(screen.getByPlaceholderText('Search...'), 'inv');

        expect(screen.getByText('Loading...')).toBeInTheDocument();
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('drops the rows for the previous query while the next one is in flight', async () => {
        const user = userEvent.setup();
        const fetch = vi.fn(() => Promise.resolve<Options>([{ value: 'orders', label: 'orders' }]));

        renderWithProviders(<Select options={fetch} allowSearch />);
        await openDropdown(user);
        expect(await screen.findByText('orders')).toBeInTheDocument();

        await user.type(screen.getByPlaceholderText('Search...'), 'inv');

        expect(screen.queryByText('orders')).not.toBeInTheDocument();
    });

    it('lets the newest search win when an earlier one resolves after it', async () => {
        const user = userEvent.setup();
        const settlers: Array<(options: Options) => void> = [];
        const fetch = vi.fn(
            () =>
                new Promise<Options>((resolve) => {
                    settlers.push(resolve);
                }),
        );
        // The debounce is real time, so each search needs a real beat to leave.
        const afterDebounce = () => new Promise((resolve) => setTimeout(resolve, 700));

        renderWithProviders(<Select options={fetch} allowSearch />);
        await openDropdown(user);
        await user.type(screen.getByPlaceholderText('Search...'), 'res');
        await act(afterDebounce);
        await user.type(screen.getByPlaceholderText('Search...'), 'ear');
        await act(afterDebounce);

        expect(settlers.length).toBeGreaterThanOrEqual(3);

        // The later search lands first, then the earlier one — which must not overwrite it.
        await act(async () => {
            settlers.at(-1)?.([{ value: 'research', label: 'research' }]);
        });
        await act(async () => {
            settlers.at(-2)?.([{ value: 'reservations', label: 'reservations' }]);
        });

        expect(await screen.findByText('research')).toBeInTheDocument();
        expect(screen.queryByText('reservations')).not.toBeInTheDocument();
    });

    it('accepts a caller-supplied loading message', async () => {
        const user = userEvent.setup();
        const { fetch } = deferredOptions();

        renderWithProviders(<Select options={fetch} loadingText="Loading collections..." />);
        await openDropdown(user);

        expect(await screen.findByText('Loading collections...')).toBeInTheDocument();
    });

    it('renders silent row shapes when the caller opts into the skeleton variant', async () => {
        const user = userEvent.setup();
        const { fetch } = deferredOptions();

        renderWithProviders(<Select options={fetch} loadingVariant="skeleton" />);
        await openDropdown(user);

        expect(await screen.findByRole('status', { name: 'Loading options' })).toBeInTheDocument();
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('does not resume the previous page cursor when a refetch fails', async () => {
        const user = userEvent.setup();
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const page0: PaginatedSelectData<string> = {
            list: [{ value: 'row-0', label: 'row-0' }],
            pageInfo: { page: 0, total_pages: 3 },
        };
        // The reopen rejects, so `fetchOptions` never reaches its `setPageInfo` call. Only the
        // reset on close stops the cursor from the first open outliving the list it described.
        const fetch = vi.fn((_query: string, _page: number = 0) =>
            fetch.mock.calls.length === 1 ? Promise.resolve(page0) : Promise.reject(new Error('boom')),
        );

        renderWithProviders(<Select options={fetch} />);

        await openDropdown(user);
        expect(await screen.findByText('row-0')).toBeInTheDocument();

        await user.click(screen.getByRole('combobox'));
        await openDropdown(user);
        // A rejected fetch leaves the previous list on screen, so this is the reopen settling.
        expect(await screen.findByText('row-0')).toBeInTheDocument();

        await fireSentinel();

        expect(fetch.mock.calls.map(([, page]) => page)).toEqual([0, 0]);
        consoleError.mockRestore();
    });

    it('still shows the empty text straight away for a static empty list', async () => {
        const user = userEvent.setup();

        renderWithProviders(<Select options={[]} />);
        await openDropdown(user);

        expect(await screen.findByText('No option found.')).toBeInTheDocument();
    });
});
