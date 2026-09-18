import { CircleAlert, PlusIcon, RefreshCw } from 'lucide-react';
import type { FC } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MessagesErrorPanelProps {
    onRetry: () => void;
    onNewChat: () => void;
}

export const MessagesErrorPanel: FC<MessagesErrorPanelProps> = ({ onRetry, onNewChat }) => (
    <div className="messages-error-panel flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <span
            className={cn(
                'flex size-9 items-center justify-center rounded-xl',
                'bg-[color-mix(in_srgb,var(--destructive)_8%,var(--surface))] text-destructive',
                'border border-[color-mix(in_srgb,var(--destructive)_14%,var(--border))]',
            )}
        >
            <CircleAlert size={16} aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Could not load this conversation</span>
            <span className="text-xs leading-normal text-text-secondary">
                Its messages did not load, so you cannot continue it yet. Check your connection and try again.
            </span>
        </div>
        <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" className="rounded-[10px]" onClick={onRetry}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Retry
            </Button>
            <Button type="button" variant="ghost" size="sm" className="rounded-[10px]" onClick={onNewChat}>
                <PlusIcon className="size-4" aria-hidden="true" />
                Start a new chat
            </Button>
        </div>
    </div>
);
