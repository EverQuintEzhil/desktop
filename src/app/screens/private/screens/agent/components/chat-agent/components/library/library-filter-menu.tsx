import {
    CheckIcon,
    FileIcon,
    FileTextIcon,
    HeartIcon,
    ImageIcon,
    ListFilterIcon,
    PresentationIcon,
    SheetIcon,
    SparklesIcon,
    UploadIcon,
    type LucideIcon,
} from 'lucide-react';

import type { LibraryFilters } from '@/components/agent-chat/hooks/use-media-library';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRoot,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import type { ArtifactType } from '@/lib/api/app/artifact';
import { cn } from '@/lib/utils';

import { ARTIFACT_TYPE_ORDER, artifactTypeMeta } from './artifact-type-meta';

type FileTypeValue = NonNullable<LibraryFilters['fileType']>;
type SourceValue = NonNullable<LibraryFilters['source']>;

interface Props {
    filters: LibraryFilters;
    onChange: (filters: LibraryFilters) => void;
    artifactType?: ArtifactType;
    onArtifactTypeChange?: (artifactType?: ArtifactType) => void;
}

const SOURCE_OPTIONS: { value: SourceValue; label: string; Icon: LucideIcon }[] = [
    { value: 'uploaded', label: 'Uploaded', Icon: UploadIcon },
    { value: 'generated', label: 'Generated', Icon: SparklesIcon },
];

const FILE_TYPE_OPTIONS: { value: FileTypeValue; label: string; Icon: LucideIcon }[] = [
    { value: 'image', label: 'Images', Icon: ImageIcon },
    { value: 'document', label: 'Documents', Icon: FileTextIcon },
    { value: 'spreadsheet', label: 'Spreadsheets', Icon: SheetIcon },
    { value: 'presentation', label: 'Presentations', Icon: PresentationIcon },
    { value: 'pdf', label: 'PDFs', Icon: FileIcon },
];

const countActiveFilters = (filters: LibraryFilters, artifactType?: ArtifactType): number => {
    let count = 0;

    if (filters.source) count += 1;
    if (filters.fileType) count += 1;
    if (filters.liked) count += 1;
    if (artifactType) count += 1;

    return count;
};

const LibraryFilterMenu = ({ filters, onChange, artifactType, onArtifactTypeChange }: Props) => {
    const activeCount = countActiveFilters(filters, artifactType);

    const toggleLiked = () => {
        onChange({ ...filters, liked: !filters.liked });
    };

    const toggleSource = (value: SourceValue) => {
        onChange({ ...filters, source: filters.source === value ? undefined : value });
    };

    const toggleFileType = (value: FileTypeValue) => {
        onChange({
            ...filters,
            fileType: filters.fileType === value ? undefined : value,
        });
    };

    const toggleArtifactType = (value: ArtifactType) => {
        onArtifactTypeChange?.(artifactType === value ? undefined : value);
    };

    const preventClose = (event: Event) => {
        event.preventDefault();
    };

    const renderCheckbox = (key: string, label: string, Icon: LucideIcon, checked: boolean, onToggle: () => void) => (
        <DropdownMenuItem
            key={key}
            onSelect={(event) => {
                preventClose(event);
                onToggle();
            }}
            className="cursor-pointer justify-between gap-2 focus:text-primary! focus:[&_svg]:text-primary!"
        >
            <span className="flex items-center gap-2">
                <Icon className="size-4" />
                {label}
            </span>
            <CheckIcon className={cn('size-4 text-primary', checked ? 'opacity-100' : 'opacity-0')} />
        </DropdownMenuItem>
    );

    const renderArtifactTypes = () => {
        if (!onArtifactTypeChange) return null;

        return (
            <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Artifact type</DropdownMenuLabel>
                {ARTIFACT_TYPE_ORDER.map((value) => {
                    const { label, Icon } = artifactTypeMeta(value);

                    return renderCheckbox(`artifact-${value}`, label, Icon, artifactType === value, () =>
                        toggleArtifactType(value),
                    );
                })}
            </>
        );
    };

    return (
        <DropdownMenuRoot>
            <SimpleTooltip content="Filter" side="bottom">
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="secondary"
                        size="icon-sm"
                        aria-label="Filter library"
                        className="relative rounded-full"
                    >
                        <ListFilterIcon className="size-4" />
                        {activeCount > 0 ? (
                            <span className="absolute -top-0.5 -right-0.5 flex size-3 rounded-full bg-primary" />
                        ) : null}
                    </Button>
                </DropdownMenuTrigger>
            </SimpleTooltip>
            <DropdownMenuContent align="end" className="w-56">
                {renderCheckbox('liked', 'Liked', HeartIcon, Boolean(filters.liked), toggleLiked)}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Source</DropdownMenuLabel>
                {SOURCE_OPTIONS.map(({ value, label, Icon }) =>
                    renderCheckbox(value, label, Icon, filters.source === value, () => toggleSource(value)),
                )}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>File type</DropdownMenuLabel>
                {FILE_TYPE_OPTIONS.map(({ value, label, Icon }) =>
                    renderCheckbox(value, label, Icon, filters.fileType === value, () => toggleFileType(value)),
                )}
                {renderArtifactTypes()}
            </DropdownMenuContent>
        </DropdownMenuRoot>
    );
};

export default LibraryFilterMenu;
