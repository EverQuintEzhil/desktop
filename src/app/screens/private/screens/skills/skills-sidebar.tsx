import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
    ChevronDown,
    CircleAlert,
    ClipboardListIcon,
    FileCode2Icon,
    Loader2Icon,
    RefreshCw,
    UploadIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { PickerListEmpty } from '@/app/components/picker/picker-list-empty';
import { InfiniteScrollTrigger, SearchInput } from '@/components';
import { DescriptionHoverCard } from '@/components/description-hover-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useInfiniteScroll } from '@/hooks';
import { skillsApi, useSkillsInfiniteQuery } from '@/lib/api/common/skills';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';
import type { SkillType } from '@/types/admin';
import { acceptValidFilesFromInput } from '@/utils';

import { CreateSkillModal } from './create-skill-modal';

interface SkillsSidebarProps {
    selectedSkillId?: string;
    onSelectSkill: (id: string) => void;
    className?: string;
    isUploading: boolean;
    onUploadFile: (file: File) => void;
}

interface SkillGroup {
    label: string;
    items: SkillType[];
}

const SKELETON_COUNT = 6;

const SkillsSidebar = ({
    selectedSkillId,
    onSelectSkill,
    className,
    isUploading,
    onUploadFile,
}: SkillsSidebarProps) => {
    const currentUser = useSelector(selectUser);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        // Re-validate file type (extension + MIME); toasts + resets input on rejection.
        const [file] = acceptValidFilesFromInput(event);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        if (!file) return;

        onUploadFile(file);
    };

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);

        return () => clearTimeout(handler);
    }, [search]);

    const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
        useSkillsInfiniteQuery({
            search: debouncedSearch,
            sort: [],
            accessibleOnly: true,
        });

    const skills = useMemo(() => data?.pages.flatMap((page) => page.values) ?? [], [data]);

    // Personal skills come from a dedicated `createdByMe` query so they always appear
    // regardless of infinite-scroll pagination. Cap of 100 is an accepted known limit.
    const { data: personalData, isLoading: isPersonalLoading } = useQuery({
        queryKey: ['skills', 'sidebar', 'personal', debouncedSearch],
        queryFn: () => skillsApi.list({ createdByMe: true, size: 100, search: debouncedSearch }),
        placeholderData: keepPreviousData,
    });

    const groups = useMemo<SkillGroup[]>(() => {
        const personal = personalData?.values ?? [];
        const shared = skills.filter((skill) => skill.creator?._id !== currentUser._id);

        return [
            { label: 'Custom Skills', items: personal },
            { label: 'Firmwide Skills', items: shared },
        ].filter((group) => group.items.length > 0);
    }, [skills, personalData, currentUser._id]);

    const onLoadMore = useCallback(() => {
        if (hasNextPage) {
            void fetchNextPage();
        }
    }, [fetchNextPage, hasNextPage]);

    const { loadMoreRef } = useInfiniteScroll({
        loading: isLoading,
        showMoreLoading: isFetchingNextPage,
        hasMore: !!hasNextPage,
        itemsLength: skills.length,
        onLoadMore,
    });

    const renderUploadItemContent = () => {
        if (isUploading) {
            return (
                <>
                    <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                    Uploading...
                </>
            );
        }

        return (
            <>
                <UploadIcon className="size-4" aria-hidden="true" />
                Upload a skill
            </>
        );
    };

    const renderItem = (skill: SkillType) => {
        const isSelected = skill._id === selectedSkillId;
        const isCustom = skill.creator?._id === currentUser._id;
        // Mirror the backend's global-enabled default: an explicit preference row wins,
        // otherwise a skill you own is in use by default while firmwide skills are opt-in.
        const isEnabled = skill.globalEnabled ?? (skill.preference ? !skill.preference.disabled : isCustom);

        const renderStatusBadge = () => {
            if (isEnabled) {
                return (
                    <Badge
                        variant="secondary"
                        className="ml-auto h-4 shrink-0 rounded-full border-transparent bg-primary/10 px-1.5 text-[10px] leading-none font-medium text-primary"
                    >
                        Enabled
                    </Badge>
                );
            }

            return (
                <Badge
                    variant="secondary"
                    className="ml-auto h-4 shrink-0 rounded-full border-transparent bg-muted px-1.5 text-[10px] leading-none font-medium text-muted-foreground"
                >
                    Disabled
                </Badge>
            );
        };

        const renderDescription = () => {
            if (!skill.description) {
                return null;
            }

            return (
                <DescriptionHoverCard name={skill.name} description={skill.description} dismissOnTriggerClick>
                    <span className="truncate text-xs text-muted-foreground">{skill.description}</span>
                </DescriptionHoverCard>
            );
        };

        return (
            <li key={skill._id} className="">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onSelectSkill(skill._id)}
                    className={cn(
                        'group h-auto w-full justify-start gap-3 rounded-none px-4 py-2 text-left whitespace-normal transition-colors',
                        isSelected
                            ? 'bg-primary/10 text-primary hover:bg-primary/10'
                            : 'text-foreground hover:bg-primary/10 active:bg-primary/10',
                    )}
                    aria-current={isSelected ? 'page' : undefined}
                >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <FileCode2Icon className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-sm font-medium">{skill.name}</span>
                            {renderStatusBadge()}
                        </span>
                        {renderDescription()}
                    </span>
                </Button>
            </li>
        );
    };

    const renderGroup = (group: SkillGroup) => (
        <li key={group.label} className="skills-sidebar-group flex flex-col gap-2">
            <span className="flex items-center justify-between px-4 pt-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {group.label}
                <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">
                    {group.items.length}
                </Badge>
            </span>
            <ul className="skills-sidebar-group-items flex flex-col gap-1">{group.items.map(renderItem)}</ul>
        </li>
    );

    const renderGroups = () => <ul className="skills-sidebar-groups flex flex-col">{groups.map(renderGroup)}</ul>;

    const renderLoading = () => (
        <ul className="skills-sidebar-groups flex flex-col">
            <li className="skills-sidebar-group flex flex-col gap-2">
                <span className="flex items-center justify-between px-4 pt-3">
                    <Skeleton className="h-3 w-20 rounded-sm" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                </span>
                <ul className="skills-sidebar-group-items flex flex-col gap-1">
                    {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                        <li
                            key={`skills-skeleton-${index}`}
                            className="flex items-center gap-3 border border-transparent px-4 py-2"
                        >
                            <Skeleton className="size-10 shrink-0 rounded-xl" />
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                                <Skeleton className={cn('h-3.5 rounded-sm', index % 2 === 0 ? 'w-3/5' : 'w-4/5')} />
                                <Skeleton className="h-3 w-20 rounded-sm" />
                            </div>
                        </li>
                    ))}
                </ul>
            </li>
        </ul>
    );

    const renderError = () => (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <span
                className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-[14px]',
                    'bg-[color-mix(in_srgb,var(--destructive)_8%,var(--surface))] text-destructive',
                    'border border-[color-mix(in_srgb,var(--destructive)_14%,var(--border))]',
                )}
            >
                <CircleAlert size={18} aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-(--text-primary)">Failed to load skills</span>
                <span className="max-w-[220px] text-xs leading-normal text-text-secondary">
                    Check your connection and try loading the skills list again.
                </span>
            </div>
            <Button
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-[10px]"
                onClick={() => void refetch()}
            >
                <RefreshCw className="size-4" aria-hidden="true" />
                Retry
            </Button>
        </div>
    );

    const renderEmpty = () => <PickerListEmpty label="skills" search={search} onClearSearch={() => setSearch('')} />;

    const renderBody = () => {
        // Both groups come from independent queries; hold the skeleton until both
        // settle so My Skills doesn't prepend above an already-rendered Firmwide list.
        if (isLoading || isPersonalLoading) {
            return renderLoading();
        }
        if (groups.length > 0) {
            return renderGroups();
        }
        if (isError) {
            return renderError();
        }

        return renderEmpty();
    };

    return (
        <div className={cn('flex min-h-[calc(100svh-80px)] flex-col bg-card lg:min-h-0', className)}>
            <div className="skills-sidebar-header flex flex-col gap-3 border-b border-border/70 bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                        <h1 className="text-lg font-semibold">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="cursor-pointer underline-offset-4 hover:underline">Skills</span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[260px]">
                                    Skills are specialized instructions agents can use to perform specific tasks.
                                </TooltipContent>
                            </Tooltip>
                        </h1>
                        <span className="text-xs text-muted-foreground">
                            Create and manage reusable skill instructions.
                        </span>
                    </div>
                    <DropdownMenuRoot modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5">
                                Add
                                <ChevronDown className="size-4 opacity-70" aria-hidden="true" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem className="cursor-pointer" onSelect={() => setIsCreateModalOpen(true)}>
                                <ClipboardListIcon className="size-4" aria-hidden="true" />
                                Write skill instructions
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="cursor-pointer"
                                disabled={isUploading}
                                onSelect={(event) => {
                                    event.preventDefault();
                                    fileInputRef.current?.click();
                                }}
                            >
                                {renderUploadItemContent()}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenuRoot>
                </div>
                <SearchInput
                    search={search}
                    searchOnChange
                    onChange={setSearch}
                    placeholder="Search skills"
                    className="max-w-full"
                />
            </div>
            <div className="skills-sidebar-content scrollbar-controller scrollbar-vertical min-h-0 flex-1 lg:pb-6">
                {renderBody()}
                <InfiniteScrollTrigger
                    loadMoreRef={loadMoreRef}
                    isLoading={isFetchingNextPage}
                    hasMore={!!hasNextPage}
                />
            </div>
            <input type="file" accept=".zip" ref={fileInputRef} className="hidden" onChange={handleUploadChange} />
            <CreateSkillModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} onSuccess={onSelectSkill} />
        </div>
    );
};

export default SkillsSidebar;
