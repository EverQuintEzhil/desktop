import { ChevronDownIcon, DownloadIcon, LinkIcon } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, type DropdownMenuOption } from '@/components/ui/dropdown-menu';
import { showErrorToast, showSuccessToast } from '@/utils';

import { artifactExtension, downloadArtifact } from './artifact-download';
import type { ArtifactVersion } from './artifact-types';
import { artifactPageLink } from './artifact-url';

const COPY_ERROR = 'Could not copy the artifact';

const COPY_LINK_ERROR = 'Could not copy the link';

interface ArtifactCopySplitProps {
    version: ArtifactVersion;
    artifactId?: string;
    agentSlug?: string;
}

export const ArtifactCopySplit = ({ version, artifactId, agentSlug }: ArtifactCopySplitProps) => {
    const copyContent = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(version.content);
            showSuccessToast('Artifact copied');
        } catch {
            showErrorToast(COPY_ERROR);
        }
    }, [version]);

    const copyLink = useCallback(async () => {
        if (!agentSlug || !artifactId) return;

        try {
            await navigator.clipboard.writeText(artifactPageLink(agentSlug, artifactId));
            showSuccessToast('Link copied');
        } catch {
            showErrorToast(COPY_LINK_ERROR);
        }
    }, [agentSlug, artifactId]);

    const options: DropdownMenuOption[] = [
        {
            label: `Download as .${artifactExtension(version)}`,
            value: 'download',
            icon: DownloadIcon,
            onClick: () => downloadArtifact(version),
        },
    ];

    if (agentSlug && artifactId) {
        options.unshift({
            label: 'Copy link',
            value: 'copy-link',
            icon: LinkIcon,
            onClick: () => void copyLink(),
        });
    }

    return (
        <div className="artifact-copy-split flex shrink-0 items-center overflow-hidden rounded-lg border border-border">
            <Button variant="ghost" size="sm" className="rounded-none" onClick={() => void copyContent()}>
                Copy
            </Button>
            <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
            <DropdownMenu
                align="end"
                trigger={
                    <Button variant="ghost" size="icon-sm" className="rounded-none" aria-label="Copy options">
                        <ChevronDownIcon />
                    </Button>
                }
                options={options}
            />
        </div>
    );
};
