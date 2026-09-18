import { AuiIf } from '@assistant-ui/react';
import { ArrowLeftIcon, HistoryIcon, PlusIcon } from 'lucide-react';
import type { FC } from 'react';
import { useSelector } from 'react-redux';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { selectTenant } from '@/store/selectors';

import type { SidebarView } from '../types';

export interface TopBarProps {
    view: SidebarView;
    onBack?: () => void;
    onNewChat: () => void;
    onToggleRecents: () => void;
}

const TopBar: FC<TopBarProps> = ({ view, onBack, onNewChat, onToggleRecents }) => {
    const tenant = useSelector(selectTenant);
    const tenantName = tenant?.name || 'Fluentmind';
    const isRecents = view === 'recents';
    const backLabel = isRecents ? 'Back to chat' : tenantName;

    const handleBack = () => {
        if (isRecents) {
            onToggleRecents();

            return;
        }

        onBack?.();
    };

    const iconBtnBase =
        'flex items-center justify-center size-8 rounded-md' +
        ' border border-transparent bg-transparent cursor-pointer shrink-0' +
        ' transition-[background,color,border-color] duration-140' +
        ' hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))] hover:text-primary';

    const renderNewChatButton = () => (
        <AuiIf condition={(s) => !s.thread.isEmpty}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        className={cn(iconBtnBase, 'text-text-secondary')}
                        aria-label="New chat"
                        onClick={onNewChat}
                    >
                        <PlusIcon size={16} aria-hidden="true" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6}>
                    New chat
                </TooltipContent>
            </Tooltip>
        </AuiIf>
    );

    const recentsBtnClass = cn(
        iconBtnBase,
        isRecents
            ? 'border-[color-mix(in_srgb,var(--primary)_18%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_9%,var(--surface))] text-primary'
            : 'text-text-secondary',
    );

    return (
        <div
            className={cn(
                'builder-chat-topbar sticky top-0 z-1 flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-background px-4',
            )}
        >
            <button
                type="button"
                className={cn(
                    'inline-flex items-center gap-1.5 text-left text-[13px] font-medium no-underline',
                    'min-h-8 cursor-pointer rounded-md border bg-transparent px-2 py-1',
                    'transition-[background,color,border-color] duration-140',
                    'hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))] hover:text-primary',
                    isRecents
                        ? 'border-[color-mix(in_srgb,var(--primary)_18%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_9%,var(--surface))] text-primary'
                        : 'border-transparent text-text-secondary',
                )}
                aria-label={isRecents ? 'Back to chat' : `Back to ${tenantName}`}
                onClick={handleBack}
            >
                <ArrowLeftIcon size={14} aria-hidden="true" />
                <span>{backLabel}</span>
            </button>

            <TooltipProvider>
                <div className="ml-auto flex items-center gap-1">
                    {renderNewChatButton()}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className={recentsBtnClass}
                                aria-label="Recents"
                                onClick={onToggleRecents}
                            >
                                <HistoryIcon size={16} aria-hidden="true" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={6}>
                            Recents
                        </TooltipContent>
                    </Tooltip>
                </div>
            </TooltipProvider>
        </div>
    );
};

export default TopBar;
