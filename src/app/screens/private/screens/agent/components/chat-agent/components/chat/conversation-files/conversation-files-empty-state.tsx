import { FileTextIcon, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface Props {
    title: string;
    description: string;
    Icon?: LucideIcon;
    hints?: string[];
}

const ConversationFilesEmptyState = ({ title, description, Icon = FileTextIcon, hints }: Props) => {
    const renderHints = () => {
        if (!hints || hints.length === 0) return null;

        return (
            <div className="flex flex-wrap items-center justify-center gap-1.5">
                {hints.map((hint) => (
                    <span
                        key={hint}
                        className={cn(
                            'rounded-full border border-border-secondary bg-background',
                            'px-2.5 py-1 text-[11px] font-medium text-text-secondary',
                        )}
                    >
                        {hint}
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-4',
                'rounded-2xl border border-dashed border-border-secondary',
                'bg-muted/20 px-5 py-10 text-center',
            )}
        >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
            </span>
            <div className="flex max-w-[240px] flex-col items-center gap-1.5">
                <span className="text-sm font-medium text-foreground">{title}</span>
                <span className="text-xs leading-5 text-text-secondary">{description}</span>
            </div>
            {renderHints()}
        </div>
    );
};

export default ConversationFilesEmptyState;
