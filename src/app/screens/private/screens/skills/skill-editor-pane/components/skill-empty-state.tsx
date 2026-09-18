import { ChevronLeftIcon, FileCode2Icon, FileIcon } from 'lucide-react';

import { LearnMoreLink } from '@/components';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { YOUTUBE_VIDEO_EMBED_KEYS } from '@/types/admin';

export interface Props {
    className?: string;
}

const SkillEmptyState = ({ className }: Props) => (
    <div className={cn('flex items-center justify-center rounded-xl bg-card p-6', className)}>
        <Card className="flex w-full max-w-2xl flex-col items-center gap-6 rounded-2xl border border-border-secondary p-8 text-center shadow-none">
            {/* Icon badge */}
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <FileCode2Icon size={34} />
            </div>

            {/* Heading */}
            <div className="mx-auto flex max-w-md flex-col gap-2">
                <Badge variant="secondary" className="mx-auto w-fit border-transparent bg-primary/10 text-primary">
                    Skills
                </Badge>
                <h2 className="text-2xl font-semibold tracking-tight">Select a skill to get started</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                    Choose a skill from the list to browse its files, view instructions, and make edits.
                </p>
            </div>

            {/* Feature hints */}
            <div className="grid w-full grid-cols-3 gap-4">
                {[
                    { icon: ChevronLeftIcon, label: 'Pick a skill' },
                    { icon: FileIcon, label: 'View files' },
                    { icon: FileCode2Icon, label: 'Edit instructions' },
                ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-3 rounded-xl bg-muted/40 p-4">
                        <Icon size={20} className="text-primary" />
                        <span className="text-xs font-medium text-muted-foreground">{label}</span>
                    </div>
                ))}
            </div>
            <LearnMoreLink embedKey={YOUTUBE_VIDEO_EMBED_KEYS.skills} label="Learn more about skills" />
        </Card>
    </div>
);

export default SkillEmptyState;
