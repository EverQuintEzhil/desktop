import { diffLines } from 'diff';
import {
    CheckIcon,
    ChevronRightIcon,
    FileTextIcon,
    type LucideIcon,
    LoaderCircleIcon,
    MoreHorizontalIcon,
    PlayIcon,
    SlidersHorizontalIcon,
    SparklesIcon,
    Trash2Icon,
    SettingsIcon,
    CopyIcon,
    RefreshCwIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { RelativeTimestamp } from '@/app/components';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCloneAgentMutation } from '@/lib/api/admin/agents';
import type { ChatAgentUiType } from '@/types/ui';

import {
    formatModelChangeSummary,
    getModelChange,
    hasNonModelChanges,
    type ModelChange,
} from '../../lib/ui-config-diff';
import { useLauncherControls } from '../publish-to-launcher';

import ModelChangesDialog from './model-changes-dialog';
import PendingChangesDiff from './pending-changes-diff';
import UiConfigChangesDialog from './ui-config-changes-dialog';

interface PendingItem {
    id: string;
    label: string;
    icon: LucideIcon;
    badge?: { added: number; removed: number };
    hint?: string;
    onOpen: () => void;
}

interface ConfigTopbarProps {
    agentName: string;
    createdAt?: string;
    updatedAt?: string;
    isLoading: boolean;
    isSaving: boolean;
    isSaved: boolean;
    hasPendingChanges?: boolean;
    hasPendingUiConfig?: boolean;
    isPublishing?: boolean;
    originalInstructions?: string;
    currentInstructions?: string;
    getPublishedUiConfig?: () => ChatAgentUiType | undefined;
    getCurrentUiConfig?: () => ChatAgentUiType | undefined;
    getAgentDescription?: () => string;
    onPublish?: () => Promise<void>;
    onDiscardPending?: () => Promise<void>;
    onDiscardModel?: () => void | Promise<void>;
    onDiscardAppearance?: () => void | Promise<void>;
    onPreview: () => void;
    onDelete: () => void | Promise<void>;
    isDeleting?: boolean;
    onViewAdvancedSettings?: () => void;
}

const ConfigTopbar = ({
    agentName,
    createdAt,
    updatedAt,
    isLoading,
    isSaving,
    isSaved,
    hasPendingChanges,
    hasPendingUiConfig,
    isPublishing,
    originalInstructions,
    currentInstructions,
    getPublishedUiConfig,
    getCurrentUiConfig,
    getAgentDescription,
    onPublish,
    onDiscardPending,
    onDiscardModel,
    onDiscardAppearance,
    onPreview,
    onDelete,
    isDeleting,
    onViewAdvancedSettings,
}: ConfigTopbarProps) => {
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [cloneOpen, setCloneOpen] = useState(false);
    const [diffOpen, setDiffOpen] = useState(false);
    const [appearanceDiffOpen, setAppearanceDiffOpen] = useState(false);
    const [appearanceData, setAppearanceData] = useState<{
        original?: ChatAgentUiType;
        current?: ChatAgentUiType;
    }>({});
    const [modelDiffOpen, setModelDiffOpen] = useState(false);
    const [modelData, setModelData] = useState<{ original?: ChatAgentUiType; current?: ChatAgentUiType }>({});
    const [pendingPopoverOpen, setPendingPopoverOpen] = useState(false);
    const displayName = agentName.trim() ? agentName : 'New agent';

    const navigate = useNavigate();
    const { id: agentId } = useParams<{ id: string }>();
    const cloneMutation = useCloneAgentMutation();

    const launcherControls = useLauncherControls({ agentId, agentName: displayName, getAgentDescription });

    const handleCloneConfirm = async () => {
        if (!agentId) return;

        try {
            const clonedAgent = await cloneMutation.mutateAsync(agentId);

            setCloneOpen(false);
            toast.success('Agent cloned successfully');
            navigate(`/agent-builder/${clonedAgent._id}`);
        } catch {
            toast.error('Failed to clone agent');
        }
    };

    const { addedLines, removedLines } = useMemo(() => {
        if (!hasPendingChanges) {
            return { addedLines: 0, removedLines: 0 };
        }

        const parts = diffLines(originalInstructions ?? '', currentInstructions ?? '');

        return {
            addedLines: parts.filter((p) => p.added).reduce((acc, p) => acc + (p.count ?? 0), 0),
            removedLines: parts.filter((p) => p.removed).reduce((acc, p) => acc + (p.count ?? 0), 0),
        };
    }, [hasPendingChanges, originalInstructions, currentInstructions]);

    const publishedUiConfig = getPublishedUiConfig?.();
    const currentUiConfig = getCurrentUiConfig?.();
    const modelChange: ModelChange | null = hasPendingUiConfig
        ? getModelChange(publishedUiConfig, currentUiConfig)
        : null;
    const appearanceChanged = hasPendingUiConfig && hasNonModelChanges(publishedUiConfig, currentUiConfig);

    const renderTimestamps = () => {
        if (isLoading) return null;

        return (
            <div className="flex min-w-0 items-center gap-3">
                <RelativeTimestamp label="Created" date={createdAt} />
                <RelativeTimestamp label="Updated" date={updatedAt} />
            </div>
        );
    };

    const renderStatus = () => {
        if (isLoading) {
            return (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <LoaderCircleIcon className="size-3 animate-spin" aria-hidden="true" />
                    Loading…
                </span>
            );
        }

        if (isSaving) {
            return (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <LoaderCircleIcon className="size-3 animate-spin" aria-hidden="true" />
                    Saving…
                </span>
            );
        }

        if (isSaved) {
            return (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckIcon className="size-3" aria-hidden="true" />
                    Saved
                </span>
            );
        }

        return null;
    };

    const pendingItems: PendingItem[] = [];

    if (hasPendingChanges) {
        pendingItems.push({
            id: 'instructions',
            label: 'Instructions',
            icon: FileTextIcon,
            badge: { added: addedLines, removed: removedLines },
            onOpen: () => setDiffOpen(true),
        });
    }

    if (modelChange) {
        pendingItems.push({
            id: 'model',
            label: 'Model',
            icon: SparklesIcon,
            hint: formatModelChangeSummary(modelChange),
            onOpen: () => {
                setModelData({ original: getPublishedUiConfig?.(), current: getCurrentUiConfig?.() });
                setModelDiffOpen(true);
            },
        });
    }

    if (appearanceChanged) {
        pendingItems.push({
            id: 'appearance',
            label: 'Chat appearance',
            icon: SlidersHorizontalIcon,
            onOpen: () => {
                setAppearanceData({
                    original: getPublishedUiConfig?.(),
                    current: getCurrentUiConfig?.(),
                });
                setAppearanceDiffOpen(true);
            },
        });
    }

    const renderItemBadge = (item: PendingItem) => {
        if (!item.badge) return null;

        return (
            <>
                <span className="text-xs font-medium text-emerald-500">+{item.badge.added}</span>
                <span className="text-xs font-medium text-destructive">-{item.badge.removed}</span>
            </>
        );
    };

    const renderPendingItem = (item: PendingItem) => {
        const Icon = item.icon;

        return (
            <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                onClick={() => {
                    setPendingPopoverOpen(false);
                    item.onOpen();
                }}
            >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 font-medium text-foreground">{item.label}</span>
                {renderItemBadge(item)}
                {item.hint ? (
                    <span className="max-w-[140px] truncate text-xs text-muted-foreground">{item.hint}</span>
                ) : null}
                <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
        );
    };

    const renderPendingChanges = () => {
        if (pendingItems.length === 0) return null;

        return (
            <>
                <Popover
                    open={pendingPopoverOpen}
                    onOpenChange={(open) => {
                        if (open) toast.dismiss();
                        setPendingPopoverOpen(open);
                    }}
                >
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
                        >
                            {pendingItems.length} Pending change
                            {pendingItems.length === 1 ? '' : 's'}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72 p-1.5">
                        {pendingItems.map((item) => renderPendingItem(item))}
                    </PopoverContent>
                </Popover>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPublishing || isSaving}
                    onClick={() => {
                        void onPublish?.();
                    }}
                    className="rounded-full px-[14px]"
                >
                    {isPublishing ? (
                        <LoaderCircleIcon className="size-3 animate-spin" aria-hidden="true" />
                    ) : (
                        <RefreshCwIcon aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">Update</span>
                </Button>
            </>
        );
    };

    return (
        <>
            <header className="config-topbar sticky top-0 z-10 flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="shrink-0" aria-live="polite">
                        {renderStatus()}
                    </div>
                    {renderTimestamps()}
                </div>

                <TooltipProvider>
                    <div className="flex shrink-0 items-center gap-1">
                        {renderPendingChanges()}

                        <Button type="button" size="sm" className="rounded-full px-[14px]" onClick={onPreview}>
                            <PlayIcon aria-hidden="true" />
                            <span className="hidden sm:inline">Try it out</span>
                        </Button>

                        {launcherControls.button}

                        <DropdownMenuRoot>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            className="rounded-full text-text-secondary hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))] hover:text-primary"
                                            aria-label="More agent actions"
                                        >
                                            <MoreHorizontalIcon aria-hidden="true" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" sideOffset={6}>
                                    More actions
                                </TooltipContent>
                            </Tooltip>
                            {/* Radix refocuses the trigger on close, which lands ~150ms after the
                                publish dialog has mounted and yanks focus out from under it. */}
                            <DropdownMenuContent
                                align="end"
                                className="w-56"
                                onCloseAutoFocus={(event) => event.preventDefault()}
                            >
                                {launcherControls.menuItem}
                                <DropdownMenuItem
                                    variant="default"
                                    className="cursor-pointer"
                                    onSelect={() => onViewAdvancedSettings?.()}
                                >
                                    <SettingsIcon aria-hidden="true" />
                                    Advanced settings
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    variant="default"
                                    className="cursor-pointer"
                                    onSelect={() => setCloneOpen(true)}
                                >
                                    <CopyIcon aria-hidden="true" />
                                    Clone agent
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    variant="destructive"
                                    className="cursor-pointer"
                                    onSelect={() => setDeleteOpen(true)}
                                >
                                    <Trash2Icon aria-hidden="true" />
                                    Delete agent
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenuRoot>
                    </div>
                </TooltipProvider>
            </header>

            {/* Mounted only while open, so the fields seed from the agent as it is named at the
                moment it opens rather than when the builder loaded. */}
            {launcherControls.dialogs}

            <ConfirmationModal
                isOpen={deleteOpen}
                onClose={() => {
                    if (!isDeleting) setDeleteOpen(false);
                }}
                title="Delete agent"
                message="This will delete the agent and its conversations. This can't be undone."
                buttons={[
                    {
                        text: 'Cancel',
                        variant: 'secondary',
                        disabled: isDeleting,
                        onClick: () => setDeleteOpen(false),
                    },
                    {
                        text: isDeleting ? 'Deleting...' : 'Delete',
                        variant: 'destructive',
                        icon: Trash2Icon,
                        loading: isDeleting,
                        disabled: isDeleting,
                        onClick: () => {
                            void onDelete();
                        },
                    },
                ]}
            />

            <ConfirmationModal
                isOpen={cloneOpen}
                onClose={() => {
                    if (!cloneMutation.isPending) setCloneOpen(false);
                }}
                onConfirm={() => {
                    void handleCloneConfirm();
                }}
                title="Clone agent"
                confirmButtonText={cloneMutation.isPending ? 'Cloning...' : 'Clone'}
                cancelButtonText="Cancel"
                isButtonLoading={cloneMutation.isPending}
            >
                <div className="mx-auto flex flex-col items-center justify-center text-center">
                    <span className="text-sm">
                        Are you sure you want to clone the agent - &apos;
                        {displayName}
                        &apos; ?
                    </span>
                </div>
            </ConfirmationModal>

            <PendingChangesDiff
                open={diffOpen}
                originalText={originalInstructions ?? ''}
                newText={currentInstructions ?? ''}
                onClose={() => setDiffOpen(false)}
                onDiscard={() => {
                    void onDiscardPending?.();
                }}
            />

            <UiConfigChangesDialog
                open={appearanceDiffOpen}
                original={appearanceData.original}
                current={appearanceData.current}
                onClose={() => setAppearanceDiffOpen(false)}
                onDiscard={() => {
                    void onDiscardAppearance?.();
                }}
            />

            <ModelChangesDialog
                open={modelDiffOpen}
                original={modelData.original}
                current={modelData.current}
                onClose={() => setModelDiffOpen(false)}
                onDiscard={() => {
                    void onDiscardModel?.();
                }}
            />
        </>
    );
};

export default ConfigTopbar;
