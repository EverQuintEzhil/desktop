import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
    Icon: LucideIcon;
    title: string;
    description: string;
    /** Decorative icons flanking the tile; hidden below `sm`. */
    accents?: readonly [LucideIcon, LucideIcon];
    hints?: readonly string[];
    action?: ReactNode;
}

const RoutinesEmptyState = ({ Icon, title, description, accents, hints, action }: Props) => {
    const renderAccents = () => {
        if (!accents) return null;

        const [LeftIcon, RightIcon] = accents;

        return (
            <>
                <span
                    aria-hidden
                    className="absolute top-8 -left-10 hidden size-12 rotate-[-10deg] items-center justify-center rounded-2xl bg-primary/8 text-primary sm:flex"
                >
                    <LeftIcon className="size-5" />
                </span>
                <span
                    aria-hidden
                    className="absolute top-8 -right-10 hidden size-12 rotate-10 items-center justify-center rounded-2xl bg-primary/8 text-primary sm:flex"
                >
                    <RightIcon className="size-5" />
                </span>
            </>
        );
    };

    const renderHints = () => {
        if (!hints || hints.length === 0) return null;

        return (
            <div className="flex flex-wrap items-center justify-center gap-2">
                {hints.map((hint) => (
                    <span
                        key={hint}
                        className="rounded-full border border-border-secondary bg-background px-3 py-1.5 text-xs font-medium text-text-secondary"
                    >
                        {hint}
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className="routines-empty-state relative min-h-[280px] overflow-hidden rounded-3xl border border-border-secondary bg-card text-center">
            <div className="relative mx-auto flex min-h-[280px] max-w-xl flex-col items-center justify-center gap-6 px-4 py-10 sm:px-10">
                <div className="relative">
                    {renderAccents()}
                    <span className="flex size-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-[0_16px_40px] shadow-primary/22">
                        <Icon aria-hidden className="size-7" />
                    </span>
                </div>

                <div className="flex max-w-md flex-col items-center gap-2">
                    <span className="text-lg font-semibold text-foreground">{title}</span>
                    <span className="text-sm leading-6 text-text-secondary">{description}</span>
                </div>

                {action}
                {renderHints()}
            </div>
        </div>
    );
};

export default RoutinesEmptyState;
