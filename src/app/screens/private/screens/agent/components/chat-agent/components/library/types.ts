import type { LibraryItem } from '@/components/agent-chat/hooks/use-media-library';
import type { ArtifactHead } from '@/lib/api/app/artifact';

/**
 * How the open file changed, so a URL-backed consumer can pick the right history action:
 * 'open' pushes an entry, 'step' replaces it, 'close' pops it, and 'leave' asks for no history
 * action at all because the caller is navigating away from the library itself.
 */
export type PreviewIntent = 'open' | 'step' | 'close' | 'leave';

export interface LibraryFileEntry {
    kind: 'file';
    id: string;
    file: LibraryItem;
}

export interface LibraryArtifactEntry {
    kind: 'artifact';
    id: string;
    artifact: ArtifactHead;
}

export type LibraryEntry = LibraryFileEntry | LibraryArtifactEntry;
