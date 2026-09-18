import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InstructionsEditor } from './instructions-editor';

describe('InstructionsEditor', () => {
    it('renders ampersands in code spans and blocks literally (AMP-559)', async () => {
        const markdown = [
            'Perkins&Will docs live in `perkins&will/doc/`.',
            '',
            '```bash',
            'cd out && zip a.docx',
            '```',
        ].join('\n');

        render(<InstructionsEditor value={markdown} onChange={() => {}} />);

        await waitFor(() => expect(screen.getByText('perkins&will/doc/')).toBeInTheDocument());
        expect(screen.getByText(/cd out && zip a\.docx/)).toBeInTheDocument();
        expect(document.body.textContent).not.toContain('&amp;');
    });
});
