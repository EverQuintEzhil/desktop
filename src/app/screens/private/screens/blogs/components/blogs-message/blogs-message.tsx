import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface BlogsMessageProps {
    icon?: LucideIcon;
    title: string;
    hint?: string;
    action?: ReactNode;
    className?: string;
}

const BlogsMessage = (props: BlogsMessageProps) => {
    const { icon: Icon, title, hint, action, className } = props;

    return (
        <div
            className={cn(
                'blogs-message flex flex-col items-center justify-center gap-3 px-6 py-16 text-center',
                className,
            )}
        >
            {Icon ? (
                <span className="blogs-message-icon flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-6" aria-hidden="true" />
                </span>
            ) : null}
            <div className="blogs-message-copy flex max-w-sm flex-col items-center gap-1.5">
                <p className="text-sm font-medium text-(--text-primary)">{title}</p>
                {hint ? <p className="text-sm text-text-secondary">{hint}</p> : null}
            </div>
            {action}
        </div>
    );
};

export default BlogsMessage;
