import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DocPreview from './doc-preview';

const convertToHtml = vi.fn();

vi.mock('mammoth', () => ({
    default: {
        convertToHtml: (...args: unknown[]) => convertToHtml(...args),
    },
}));

describe('DocPreview', () => {
    afterEach(() => {
        convertToHtml.mockReset();
        vi.restoreAllMocks();
    });

    it('renders the converted document html', async () => {
        convertToHtml.mockResolvedValue({ value: '<h1>Quarterly report</h1><p>All good.</p>', messages: [] });

        render(<DocPreview blob={new Blob(['docx bytes'])} name="report.docx" />);

        expect(await screen.findByRole('heading', { name: 'Quarterly report' })).toBeInTheDocument();
        expect(screen.getByText('All good.')).toBeInTheDocument();
        expect(convertToHtml).toHaveBeenCalledWith({ arrayBuffer: expect.any(ArrayBuffer) });
    });

    it('sanitizes the converted html before rendering it', async () => {
        convertToHtml.mockResolvedValue({
            value: '<p>Safe</p><script>window.pwned = true;</script><img src="x" onerror="window.pwned = true;">',
            messages: [],
        });

        const { container } = render(<DocPreview blob={new Blob(['docx bytes'])} />);

        expect(await screen.findByText('Safe')).toBeInTheDocument();
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull();
    });

    it('shows the shared error copy when conversion fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        convertToHtml.mockRejectedValue(new Error('not a docx'));

        render(<DocPreview blob={new Blob(['legacy doc bytes'])} />);

        expect(
            await screen.findByText('Unable to load this file. Please try downloading it instead.'),
        ).toBeInTheDocument();
    });
});
