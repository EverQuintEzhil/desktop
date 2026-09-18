import { useMemo } from 'react';

import { cn } from '@/lib/utils';

interface ArtifactCodeProps {
    content: string;
    className?: string;
}

const LINE_CLASS_NAME = 'h-[1.5rem] leading-6';

export const ArtifactCode = ({ content, className }: ArtifactCodeProps) => {
    const lines = useMemo(() => content.split('\n'), [content]);

    return (
        <div
            data-slot="artifact-code"
            data-testid="artifact-code"
            className={cn('artifact-code relative bg-muted/40', className)}
        >
            <div className="scrollbar-controller scrollbar-vertical scrollbar-horizontal flex h-full font-mono text-xs">
                <div
                    aria-hidden
                    className="artifact-code-gutter sticky left-0 shrink-0 border-r border-border bg-muted/60 py-3 pr-3 pl-4 text-right text-muted-foreground tabular-nums select-none"
                >
                    {lines.map((_, index) => (
                        <div key={index} className={LINE_CLASS_NAME}>
                            {index + 1}
                        </div>
                    ))}
                </div>
                <pre className="my-0! min-w-0 flex-1 bg-transparent py-3 pr-4 pl-4 text-foreground">
                    <code>
                        {lines.map((line, index) => (
                            <div key={index} className={LINE_CLASS_NAME}>
                                {line || ' '}
                            </div>
                        ))}
                    </code>
                </pre>
            </div>
        </div>
    );
};
