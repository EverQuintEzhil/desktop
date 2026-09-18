import type { SharedFileItem } from '@/components/file-list/file-list-utils';
import { cn } from '@/lib/utils';

import { fileGlyphFor } from './file-type-glyph';
import { FILE_GLYPHS } from './file-type-glyphs';

interface Props {
    file: SharedFileItem;
    className?: string;
}

// The glyph variant sits on lucide's own 24×24 grid at 1.9 stroke, so it sizes with `size-*` like
// every other icon here. The accent rides on `color` and the artwork strokes `currentColor`, which
// is what lets one glyph carry a per-family hue without repeating it on every path.
const FileTypeIcon = ({ file, className }: Props) => {
    const { glyph, colorToken } = fileGlyphFor(file);

    return (
        <svg
            className={cn('size-6 shrink-0', className)}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: `var(${colorToken})` }}
            aria-hidden="true"
        >
            {FILE_GLYPHS[glyph]}
        </svg>
    );
};

export default FileTypeIcon;
