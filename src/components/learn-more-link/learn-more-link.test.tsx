import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';
import { YOUTUBE_VIDEO_EMBED_KEYS } from '@/types/admin';

import LearnMoreLink from './learn-more-link';

const renderLink = (youtubeVideoEmbeds: Record<string, string>) =>
    renderWithProviders(
        <LearnMoreLink embedKey={YOUTUBE_VIDEO_EMBED_KEYS.memory} label="Learn more about memories" />,
        { preloadedState: { tenant: { youtubeVideoEmbeds } } },
    );

describe('LearnMoreLink', () => {
    it('links to the URL the tenant configured for its embed key', () => {
        renderLink({ [YOUTUBE_VIDEO_EMBED_KEYS.memory]: 'https://youtube.com/watch?v=abc' });

        const link = screen.getByRole('link', { name: /learn more about memories/i });

        expect(link).toHaveAttribute('href', 'https://youtube.com/watch?v=abc');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders nothing when the tenant has not configured that key', () => {
        renderLink({ [YOUTUBE_VIDEO_EMBED_KEYS.skills]: 'https://youtube.com/watch?v=abc' });

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
});
