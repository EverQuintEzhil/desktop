import { Building2Icon, CheckIcon, Loader2Icon, LockIcon, XIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getDefaultToastOptions } from '@/utils/toast-theme';

interface ShareOptionProps {
    icon: typeof LockIcon;
    title: string;
    description: string;
    selected: boolean;
    disabled?: boolean;
    onSelect: () => void;
}

const ShareOption = ({ icon: Icon, title, description, selected, disabled, onSelect }: ShareOptionProps) => (
    <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
            'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
            'hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60',
        )}
    >
        <Icon className="size-5 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-foreground">{title}</span>
            <span className="truncate text-xs text-muted-foreground">{description}</span>
        </span>
        {selected && <CheckIcon className="size-4 shrink-0 text-primary" />}
    </button>
);

interface ShareChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** The link to share (typically the current conversation URL). */
    shareUrl: string;
    /** Current sharing state of the conversation. */
    isPublic: boolean;
    /** True while the initial visibility is being loaded. */
    isLoadingState: boolean;
    /** True while a visibility change is being persisted. */
    isUpdating: boolean;
    /** Persist a new visibility for the conversation; resolves to whether it succeeded. */
    onSetVisibility: (isPublic: boolean) => Promise<boolean>;
    /**
     * Name of the space/project the chat belongs to, when it is in one. Drives
     * the "share in project" wording; absent → the chat shares as a public link.
     */
    spaceName?: string | null;
}

const ShareChatModal = ({
    isOpen,
    onClose,
    shareUrl,
    isPublic,
    isLoadingState,
    isUpdating,
    onSetVisibility,
    spaceName,
}: ShareChatModalProps) => {
    const [isCopying, setIsCopying] = useState(false);
    const isInSpace = Boolean(spaceName);
    const sharedDescription = isInSpace ? `Anyone in ${spaceName} can view` : 'Anyone with the link can view';

    const handleCopyLink = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
        } catch (error) {
            console.error('Failed to copy share link', error);
            toast.error('Failed to copy link. Please try again.');

            return;
        }

        let shared = true;

        if (!isPublic) {
            setIsCopying(true);
            try {
                shared = await onSetVisibility(true);
            } finally {
                setIsCopying(false);
            }
        }

        if (!shared) return;

        // Stable id → rapid copies replace the same toast instead of stacking.
        toast('Link copied to your clipboard', {
            ...getDefaultToastOptions(),
            id: 'share-chat-link-copied',
            description: sharedDescription,
        });
    }, [shareUrl, isPublic, onSetVisibility, sharedDescription]);

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="w-[95%] max-w-[520px] gap-0 p-0 sm:w-full">
                <DialogHeader className="flex-row items-start justify-between border-none px-5 pt-5 pb-2">
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <DialogTitle className="text-xl font-semibold">Share chat</DialogTitle>
                    </div>
                    <DialogClose asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Close"
                            className="-mt-1 -mr-1.5 shrink-0"
                        >
                            <XIcon className="size-4" />
                        </Button>
                    </DialogClose>
                </DialogHeader>

                <div className="min-w-0 px-5 py-3">
                    <div className="overflow-hidden rounded-xl border border-border">
                        <ShareOption
                            icon={LockIcon}
                            title="Keep private"
                            description="Only you have access"
                            selected={!isLoadingState && !isPublic}
                            disabled={isLoadingState || isUpdating || isCopying}
                            onSelect={() => onSetVisibility(false)}
                        />
                        <div className="border-t border-border" />
                        <ShareOption
                            icon={Building2Icon}
                            title="Shared"
                            description={sharedDescription}
                            selected={!isLoadingState && isPublic}
                            disabled={isLoadingState || isUpdating || isCopying || isPublic}
                            onSelect={handleCopyLink}
                        />
                    </div>

                    <div className="mt-4 flex min-w-0 items-center gap-2 rounded-full border border-border bg-muted/40 py-1.5 pr-1.5 pl-4">
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{shareUrl}</span>
                        <Button
                            type="button"
                            size="sm"
                            className="shrink-0 rounded-full"
                            onClick={handleCopyLink}
                            disabled={isLoadingState || isCopying}
                        >
                            {isCopying ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                            Copy link
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ShareChatModal;
