import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { ArtifactPointer } from './artifact-types';
import ArtifactUrlSync from './artifact-url-sync';

const CONVERSATION_ID = 'conv-1';

const CHAT_PATH = `/agent/foo/chat/${CONVERSATION_ID}`;

const pointer = (slug: string, versionNumber: number): ArtifactPointer => ({
    toolCallId: `call-${slug}`,
    artifactId: `${CONVERSATION_ID}:${slug}`,
    slug,
    title: slug,
    artifactType: 'markdown',
    language: null,
    versionNumber,
});

const BackButton = () => {
    const navigate = useNavigate();

    return (
        <button type="button" onClick={() => navigate(-1)}>
            Go back
        </button>
    );
};

const LocationProbe = () => {
    const location = useLocation();

    return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
};

interface HarnessProps {
    conversationId?: string | null;
    pointers?: ArtifactPointer[];
}

const Harness = ({ conversationId = CONVERSATION_ID, pointers = [pointer('plan', 2)] }: HarnessProps) => {
    const [openSlug, setOpenSlug] = useState<string | null>(null);

    const resolveSlug = (slug: string) => {
        const matches = pointers.filter((candidate) => candidate.slug === slug);

        if (matches.length === 0) return null;

        return matches.reduce((best, candidate) => (candidate.versionNumber > best.versionNumber ? candidate : best));
    };

    return (
        <>
            <span data-testid="open-slug">{openSlug ?? 'none'}</span>
            <LocationProbe />
            <BackButton />
            <button type="button" onClick={() => setOpenSlug('plan')}>
                Open plan
            </button>
            <button type="button" onClick={() => setOpenSlug('notes')}>
                Open notes
            </button>
            <button type="button" onClick={() => setOpenSlug(null)}>
                Close pane
            </button>
            <ArtifactUrlSync
                conversationId={conversationId}
                openSlug={openSlug}
                resolveKey={pointers.map((candidate) => candidate.artifactId).join(',')}
                resolveSlug={resolveSlug}
                onOpen={(next) => setOpenSlug(next.slug)}
                onClose={() => setOpenSlug(null)}
            />
        </>
    );
};

const renderHarness = (initialEntry: string, props: HarnessProps = {}) =>
    render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Harness {...props} />
        </MemoryRouter>,
    );

const openSlug = () => screen.getByTestId('open-slug').textContent;

const url = () => screen.getByTestId('location').textContent;

describe('ArtifactUrlSync', () => {
    it('opens the pane from a cold load carrying the artifact param', async () => {
        renderHarness(`${CHAT_PATH}?artifact=plan`);

        await waitFor(() => expect(openSlug()).toEqual('plan'));
        expect(url()).toEqual(`${CHAT_PATH}?artifact=plan`);
    });

    it('picks the highest version when a slug was written more than once', async () => {
        const onOpen = vi.fn();

        render(
            <MemoryRouter initialEntries={[`${CHAT_PATH}?artifact=plan`]}>
                <ArtifactUrlSync
                    conversationId={CONVERSATION_ID}
                    openSlug={null}
                    resolveKey="two"
                    resolveSlug={() => pointer('plan', 3)}
                    onOpen={onOpen}
                    onClose={vi.fn()}
                />
            </MemoryRouter>,
        );

        await waitFor(() => expect(onOpen).toHaveBeenCalledWith(pointer('plan', 3)));
    });

    it('writes the param when the pane opens, and replaces it when another artifact takes over', async () => {
        const user = userEvent.setup();

        renderHarness(CHAT_PATH, { pointers: [pointer('plan', 2), pointer('notes', 1)] });

        await user.click(screen.getByRole('button', { name: 'Open plan' }));

        await waitFor(() => expect(url()).toEqual(`${CHAT_PATH}?artifact=plan`));

        await user.click(screen.getByRole('button', { name: 'Open notes' }));

        await waitFor(() => expect(url()).toEqual(`${CHAT_PATH}?artifact=notes`));

        await user.click(screen.getByRole('button', { name: 'Close pane' }));

        // One history entry for the whole pane session: a single Back lands on the bare chat URL.
        await waitFor(() => expect(url()).toEqual(CHAT_PATH));
    });

    it('closes the pane when the param is popped off the history', async () => {
        const user = userEvent.setup();

        renderHarness(CHAT_PATH);

        await user.click(screen.getByRole('button', { name: 'Open plan' }));

        await waitFor(() => expect(url()).toEqual(`${CHAT_PATH}?artifact=plan`));

        await user.click(screen.getByRole('button', { name: 'Go back' }));

        await waitFor(() => expect(openSlug()).toEqual('none'));
        expect(url()).toEqual(CHAT_PATH);
    });

    it('leaves an unknown slug alone rather than clearing the URL', async () => {
        renderHarness(`${CHAT_PATH}?artifact=missing`);

        await waitFor(() => expect(url()).toEqual(`${CHAT_PATH}?artifact=missing`));
        expect(openSlug()).toEqual('none');
    });

    it('resolves a param that only became resolvable once the thread loaded', async () => {
        const { rerender } = render(
            <MemoryRouter initialEntries={[`${CHAT_PATH}?artifact=plan`]}>
                <Harness pointers={[]} />
            </MemoryRouter>,
        );

        expect(openSlug()).toEqual('none');

        rerender(
            <MemoryRouter initialEntries={[`${CHAT_PATH}?artifact=plan`]}>
                <Harness pointers={[pointer('plan', 2)]} />
            </MemoryRouter>,
        );

        await waitFor(() => expect(openSlug()).toEqual('plan'));
    });

    it('writes nothing while a new conversation is still minting its id', async () => {
        const user = userEvent.setup();

        renderHarness('/agent/foo/chat', { conversationId: null });

        await user.click(screen.getByRole('button', { name: 'Open plan' }));

        await waitFor(() => expect(openSlug()).toEqual('plan'));
        expect(url()).toEqual('/agent/foo/chat');
    });

    it('renders nothing outside a router, so the SDK and admin hosts still mount', () => {
        const { container } = render(
            <ArtifactUrlSync
                conversationId={CONVERSATION_ID}
                openSlug="plan"
                resolveKey=""
                resolveSlug={() => null}
                onOpen={vi.fn()}
                onClose={vi.fn()}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});
