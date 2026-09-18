import { FileXIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface Props {
    className?: string;
}

const SkillNotFoundState = ({ className }: Props) => (
    <div className={cn('flex items-center justify-center rounded-xl bg-background', className)}>
        <div className="flex w-full max-w-[340px] flex-col items-center gap-5 rounded-2xl bg-card px-10 py-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-[20px] bg-destructive/10 text-destructive">
                <FileXIcon size={30} />
            </div>
            <div className="flex flex-col items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight text-foreground">Skill not found</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                    This skill may have been deleted or you may not have access.
                </p>
            </div>
        </div>
    </div>
);

export default SkillNotFoundState;
