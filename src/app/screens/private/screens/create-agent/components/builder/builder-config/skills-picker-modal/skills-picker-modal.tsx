import { CheckIcon, Loader2Icon, PlusIcon, SearchIcon, SparklesIcon, UploadIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { PickerListEmpty } from '@/app/components/picker/picker-list-empty';
import { pickerDialogCls } from '@/app/components/picker/picker-shared';
import { DescriptionHoverCard } from '@/components/description-hover-card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useInfiniteScroll } from '@/hooks';
import { useSkillsInfiniteQuery, useUploadSkillFromZipMutation } from '@/lib/api/common/skills';
import { filesApi } from '@/lib/api/files-client';
import { cn } from '@/lib/utils';
import { showErrorToast, acceptValidFilesFromInput } from '@/utils';
import { shouldEscapeKeepDialogOpen } from '@/utils/escape-cancels-edit';

import AddSkillPanel from './components/add-skill-panel';
import GenerateSkillPanel from './components/generate-skill-panel';
import SkillDetailPanel from './components/skill-detail-panel';
import { GENERATE_SKILL_COLOR } from './constants';
import { getSkillAbbr, getSkillColor } from './utils/skill-visuals';

interface SkillsPickerModalProps {
    open: boolean;
    onClose: () => void;
    selectedSkills: { _id: string; name: string; isRecommended?: boolean }[];
    onToggle: (skill: { _id: string; name: string }) => void;
    onUpdate?: (skill: { _id: string; name: string; isRecommended?: boolean }) => void;
    onGenerateSkill: (description: string) => void;
    initialViewSkillId?: string | null;
}

type ActivePanel = null | 'add-skill' | 'generate-skill' | string;

const rowBase =
    'flex items-center gap-3 min-h-[54px] px-3 py-[10px] rounded-2xl' +
    ' bg-transparent cursor-pointer text-h6 outline-none' +
    ' text-left w-full text-(--text-primary) transition-[background,color] duration-140' +
    ' hover:bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))]' +
    ' disabled:opacity-50 disabled:cursor-not-allowed';
const rowActive = 'bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))] text-primary';

export const SkillsPickerModal = ({
    open,
    onClose,
    selectedSkills,
    onToggle,
    onUpdate,
    onGenerateSkill,
    initialViewSkillId,
}: SkillsPickerModalProps) => {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activePanel, setActivePanel] = useState<ActivePanel>(initialViewSkillId ?? null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingFile, setIsUploadingFile] = useState(false);

    const uploadSkillFromZipMutation = useUploadSkillFromZipMutation();
    const isUploading = isUploadingFile || uploadSkillFromZipMutation.isPending;

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);

        return () => clearTimeout(handler);
    }, [search]);

    useEffect(() => {
        if (open) {
            setActivePanel(initialViewSkillId ?? null);
        } else {
            setActivePanel(null);
            setSearch('');
        }
    }, [open, initialViewSkillId]);

    const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useSkillsInfiniteQuery({
        pageSize: 100,
        search: debouncedSearch,
        sort: [],
    });

    const skillItems = data?.pages.flatMap((p) => p.values) ?? [];

    const { loadMoreRef } = useInfiniteScroll({
        loading: isLoading,
        showMoreLoading: isFetchingNextPage,
        hasMore: !!hasNextPage,
        itemsLength: skillItems.length,
        onLoadMore: () => {
            void fetchNextPage();
        },
    });

    const activeSkill =
        activePanel !== null && activePanel !== 'add-skill' && activePanel !== 'generate-skill'
            ? skillItems.find((item) => item._id === activePanel) || selectedSkills.find((s) => s._id === activePanel)
            : undefined;

    const isSelected = (id: string): boolean => selectedSkills.some((s) => s._id === id);

    const selectedListItems = debouncedSearch
        ? selectedSkills.filter((s) => s.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
        : selectedSkills;
    const availableListItems = skillItems.filter((s) => !isSelected(s._id));

    const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        // Re-validate file type (extension + MIME); toasts + resets input on rejection.
        const [file] = acceptValidFilesFromInput(event);

        if (!file) return;

        try {
            setIsUploadingFile(true);
            const formData = new FormData();

            formData.append('file', file);

            const uploadResponse = await filesApi.upload(formData);
            const fileId = uploadResponse.data?.value?.values?.[0]?._id;

            if (!fileId) {
                throw new Error('Failed to get file ID from upload response');
            }

            const response = await uploadSkillFromZipMutation.mutateAsync({ fileId });

            if (response?._id) {
                onToggle({ _id: response._id, name: response.name });
                setActivePanel(response._id);
            }
        } catch (error) {
            const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
            const errorMessage =
                axiosError.response?.data?.message || axiosError.message || 'Failed to upload skill zip.';

            showErrorToast(errorMessage);
        } finally {
            setIsUploadingFile(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const renderRightPanel = () => {
        if (activePanel === 'generate-skill') {
            return (
                <GenerateSkillPanel
                    onGenerateSkill={onGenerateSkill}
                    onBack={() => setActivePanel(null)}
                    onClose={onClose}
                />
            );
        }

        if (activePanel === null || activePanel === 'add-skill') {
            return (
                <AddSkillPanel
                    onBack={() => setActivePanel(null)}
                    onClose={onClose}
                    onSuccess={(skill) => {
                        onToggle(skill);
                        setActivePanel(skill._id);
                    }}
                />
            );
        }

        if (activeSkill) {
            return (
                <SkillDetailPanel
                    key={activeSkill._id}
                    skill={activeSkill}
                    isSelected={isSelected(activeSkill._id)}
                    isRecommended={!!selectedSkills.find((s) => s._id === activeSkill._id)?.isRecommended}
                    onToggle={onToggle}
                    onUpdate={
                        onUpdate
                            ? (isRecommended) =>
                                  onUpdate({ _id: activeSkill._id, name: activeSkill.name, isRecommended })
                            : undefined
                    }
                    onBack={() => setActivePanel(null)}
                    onClose={onClose}
                />
            );
        }

        return null;
    };

    const renderPopularSkills = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2">
                            <div className="h-[42px] w-[42px] shrink-0 rounded-[14px] bg-foreground/10" />
                            <div
                                className="h-3 flex-1 rounded bg-foreground/10"
                                style={{ width: `${55 + (i % 3) * 15}%` }}
                            />
                        </div>
                    ))}
                </div>
            );
        }

        if (isError) {
            const message = error instanceof Error ? error.message : 'Failed to load skills.';

            return (
                <p className="px-3 py-2 text-xs" style={{ color: 'var(--danger)' }}>
                    {message}
                </p>
            );
        }

        const totalItems = selectedListItems.length + availableListItems.length;

        if (totalItems === 0) {
            return <PickerListEmpty label="skills" search={debouncedSearch} onClearSearch={() => setSearch('')} />;
        }

        const renderRow = (item: { _id: string; name: string; description?: string }) => {
            const abbr = getSkillAbbr(item.name);
            const color = getSkillColor(item._id);

            return (
                <button
                    key={item._id}
                    className={cn(rowBase, activePanel === item._id && rowActive)}
                    onClick={() => setActivePanel(item._id)}
                >
                    <span
                        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] text-[13px] font-bold text-white"
                        style={{ background: color }}
                    >
                        {abbr}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="min-w-0 overflow-hidden font-medium text-ellipsis whitespace-nowrap">
                            {item.name}
                        </span>
                        {item.description && (
                            <DescriptionHoverCard name={item.name} description={item.description}>
                                <span className="line-clamp-2 text-xs text-text-secondary">{item.description}</span>
                            </DescriptionHoverCard>
                        )}
                    </span>
                    {isSelected(item._id) && (
                        <CheckIcon size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} aria-hidden="true" />
                    )}
                </button>
            );
        };

        return (
            <>
                {selectedListItems.length > 0 && (
                    <>
                        <div className="px-2 pt-2 pb-1 text-[10px] font-bold tracking-[0.07em] text-text-secondary uppercase">
                            Selected Skills
                        </div>
                        {selectedListItems.map(renderRow)}
                        <div className="px-2 pt-3 pb-1 text-[10px] font-bold tracking-[0.07em] text-text-secondary uppercase">
                            Skills
                        </div>
                    </>
                )}
                {availableListItems.map(renderRow)}
            </>
        );
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose();
            }}
        >
            <DialogContent
                overlayClassName="bg-(--grey-alpha-6)!"
                className={pickerDialogCls}
                onEscapeKeyDown={(event) => {
                    if (shouldEscapeKeepDialogOpen(event)) {
                        event.preventDefault();
                    }
                }}
            >
                <div
                    className={cn(
                        'scrollbar-controller scrollbar-vertical shrink-0 scrollbar-gutter-stable flex-col border-r border-border',
                        'w-full sm:w-xs',
                        activePanel !== null ? 'hidden sm:flex' : 'flex',
                    )}
                >
                    <div
                        className={
                            'sticky top-0 flex h-[80px] shrink-0 items-center gap-2 border-b bg-card p-4 text-text-secondary'
                        }
                    >
                        <SearchIcon size={20} aria-hidden="true" />
                        <input
                            className="flex-1 border-0 bg-transparent text-[13px] text-(--text-primary) outline-none placeholder:text-text-secondary"
                            placeholder="Search skills"
                            aria-label="Search skills"
                            value={search}
                            autoFocus
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search ? (
                            <Button
                                type="button"
                                variant="secondary"
                                size="icon-sm"
                                className="rounded-md"
                                aria-label="Clear search"
                                onClick={() => setSearch('')}
                            >
                                <XIcon aria-hidden="true" />
                            </Button>
                        ) : null}
                    </div>
                    <div className="flex-1 p-3">
                        <button
                            className={cn(rowBase, activePanel === 'generate-skill' && rowActive)}
                            onClick={() => setActivePanel('generate-skill')}
                        >
                            <span
                                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] text-[13px] font-bold text-white"
                                style={{ background: GENERATE_SKILL_COLOR }}
                            >
                                <SparklesIcon size={14} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1 overflow-hidden font-medium text-ellipsis whitespace-nowrap">
                                Generate skill
                            </span>
                        </button>
                        <button
                            className={cn(rowBase, (activePanel === null || activePanel === 'add-skill') && rowActive)}
                            onClick={() => setActivePanel('add-skill')}
                        >
                            <span
                                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] text-[13px] font-bold text-white"
                                style={{ background: 'var(--primary)' }}
                            >
                                <PlusIcon size={14} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1 overflow-hidden font-medium text-ellipsis whitespace-nowrap">
                                Add skill
                            </span>
                        </button>
                        <input
                            type="file"
                            accept=".zip"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={(e) => void handleUploadChange(e)}
                        />
                        <button
                            className={rowBase}
                            disabled={isUploading}
                            aria-label="Upload skill"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <span
                                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] text-[13px] font-bold text-white"
                                style={{ background: 'var(--neutral-mid)' }}
                            >
                                {isUploading ? (
                                    <Loader2Icon size={14} className="animate-spin" aria-hidden="true" />
                                ) : (
                                    <UploadIcon size={14} aria-hidden="true" />
                                )}
                            </span>
                            <span className="min-w-0 flex-1 overflow-hidden font-medium text-ellipsis whitespace-nowrap">
                                {isUploading ? 'Uploading...' : 'Upload skill'}
                            </span>
                        </button>

                        {renderPopularSkills()}
                        <div ref={loadMoreRef} />
                        {isFetchingNextPage ? (
                            <div className="flex justify-center py-3">
                                <Loader2Icon
                                    size={16}
                                    className="animate-spin text-text-secondary"
                                    aria-hidden="true"
                                />
                            </div>
                        ) : null}
                    </div>
                </div>

                <div
                    className={cn(
                        'skill-picker-detail-pane scrollbar-controller scrollbar-vertical flex-1 flex-col bg-card',
                        activePanel !== null ? 'flex' : 'hidden sm:flex',
                    )}
                >
                    {renderRightPanel()}
                </div>
            </DialogContent>
        </Dialog>
    );
};
