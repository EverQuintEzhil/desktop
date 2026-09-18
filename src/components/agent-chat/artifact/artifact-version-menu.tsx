import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, type DropdownMenuOption } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatDateShort } from '@/utils/date';

import type { ArtifactVersionMeta } from './artifact-types';

const BADGE_CLASS_NAME = 'shrink-0 text-xs leading-4 font-medium mt-0.5';

const OUT_SPECIFYING_BYLINE_CLASS_NAME = 'truncate text-xs leading-4 text-muted-foreground!';

const authorLabel = (version: ArtifactVersionMeta): string =>
    version.authorName ?? (version.authorKind === 'model' ? 'the assistant' : 'a teammate');

interface ArtifactVersionMenuProps {
    versions: ArtifactVersionMeta[] | undefined;
    versionNumber: number;
    latestVersion: number | undefined;
    onVersionChange: (versionNumber: number) => void;
}

export const ArtifactVersionMenu = ({
    versions,
    versionNumber,
    latestVersion,
    onVersionChange,
}: ArtifactVersionMenuProps) => {
    const newestFirstVersions = useMemo(
        () => [...(versions ?? [])].sort((first, second) => second.versionNumber - first.versionNumber),
        [versions],
    );

    const options = useMemo<DropdownMenuOption[]>(
        () =>
            newestFirstVersions.map((item) => {
                const isCurrent = item.versionNumber === versionNumber;
                const isLatest = item.versionNumber === latestVersion;

                return {
                    value: String(item.versionNumber),
                    onClick: () => onVersionChange(item.versionNumber),
                    label: (
                        <span className="artifact-version-row flex w-full items-center gap-3">
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate text-sm leading-5 font-medium text-foreground">
                                        v{item.versionNumber}
                                    </span>
                                    {isLatest ? (
                                        <span className={cn(BADGE_CLASS_NAME, 'text-muted-foreground!')}>Latest</span>
                                    ) : null}
                                    {isCurrent ? (
                                        <span className={cn(BADGE_CLASS_NAME, 'text-primary')}>Current</span>
                                    ) : null}
                                </span>
                                <span className={OUT_SPECIFYING_BYLINE_CLASS_NAME}>
                                    {`${authorLabel(item)} · ${formatDateShort(item.createdAt)}`}
                                </span>
                            </span>
                            {isCurrent ? (
                                <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                            ) : null}
                        </span>
                    ),
                };
            }),
        [newestFirstVersions, versionNumber, latestVersion, onVersionChange],
    );

    if (options.length === 0) return null;

    return (
        <DropdownMenu
            align="end"
            contentClassName="scrollbar-controller scrollbar-vertical max-h-[60svh] w-[264px] p-1.5"
            itemClassName="rounded-lg py-2 [&>span]:min-w-0 [&>span]:flex-1"
            trigger={
                <Button variant="ghost" size="sm" className="artifact-version-menu-trigger gap-1.5">
                    {versionNumber === latestVersion ? 'Latest' : `v${versionNumber}`}
                    <ChevronDownIcon />
                </Button>
            }
            options={options}
        />
    );
};
