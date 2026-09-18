import { FileIcon, SparklesIcon, type LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

export interface Props {
    title: string;
    description: string;
    Icon: LucideIcon;
    supportItems: { label: string; Icon: LucideIcon }[];
}

const EmptyStateCard = ({ title, description, Icon, supportItems }: Props) => (
    <Card className="relative min-h-[280px] overflow-hidden rounded-3xl border-border-secondary bg-card py-0 text-center shadow-none">
        <CardContent className="relative mx-auto flex min-h-[280px] max-w-xl flex-col items-center justify-center gap-6 px-4 py-10 sm:px-10">
            <div className="relative">
                <span
                    aria-hidden
                    className="absolute top-8 -left-10 hidden size-12 rotate-[-10deg] items-center justify-center rounded-2xl bg-primary/8 text-primary sm:flex"
                >
                    <SparklesIcon className="size-5" />
                </span>
                <span
                    aria-hidden
                    className="absolute top-8 -right-10 hidden size-12 rotate-10 items-center justify-center rounded-2xl bg-primary/8 text-primary sm:flex"
                >
                    <FileIcon className="size-5" />
                </span>
                <span className="flex size-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-[0_16px_40px] shadow-primary/22">
                    <Icon className="size-7" />
                </span>
            </div>

            <div className="flex max-w-md flex-col items-center gap-2">
                <span className="text-lg font-semibold text-foreground">{title}</span>
                <span className="text-sm leading-6 text-text-secondary">{description}</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
                {supportItems.map(({ label, Icon: SupportIcon }) => (
                    <span
                        key={label}
                        className="flex items-center gap-2 rounded-full border border-border-secondary bg-background px-3 py-1.5 text-xs font-medium text-text-secondary"
                    >
                        <SupportIcon className="size-3.5 text-primary" />
                        {label}
                    </span>
                ))}
            </div>
        </CardContent>
    </Card>
);

export default EmptyStateCard;
