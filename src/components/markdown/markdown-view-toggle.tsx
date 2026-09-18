import { CodeXmlIcon, EyeIcon } from 'lucide-react';

import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';

export type MarkdownViewMode = 'rendered' | 'code';

interface MarkdownViewToggleProps {
    mode: MarkdownViewMode;
    onModeChange: (mode: MarkdownViewMode) => void;
    className?: string;
}

const itemCls = (active: boolean) =>
    cn(
        'flex h-6 min-w-8 cursor-pointer items-center justify-center rounded-md border px-2 transition-all',
        active
            ? 'border-border text-neutral-700 shadow-sm'
            : 'border-transparent text-foreground/60 hover:text-foreground',
    );

/**
 * Segmented toggle for switching a read-only markdown file between its
 * rendered preview and its raw source (code) view.
 */
export const MarkdownViewToggle = ({ mode, onModeChange, className }: MarkdownViewToggleProps) => (
    <div className={cn('inline-flex shrink-0 items-center gap-1 rounded-lg bg-muted-foreground/15 p-[3px]', className)}>
        <SimpleTooltip content="Preview">
            <button
                type="button"
                aria-label="Rendered preview"
                aria-pressed={mode === 'rendered'}
                className={itemCls(mode === 'rendered')}
                style={mode === 'rendered' ? { backgroundColor: '#ffffff' } : undefined}
                onClick={() => onModeChange('rendered')}
            >
                <EyeIcon size={14} />
            </button>
        </SimpleTooltip>
        <SimpleTooltip content="View source">
            <button
                type="button"
                aria-label="Raw source"
                aria-pressed={mode === 'code'}
                className={itemCls(mode === 'code')}
                style={mode === 'code' ? { backgroundColor: '#ffffff' } : undefined}
                onClick={() => onModeChange('code')}
            >
                <CodeXmlIcon size={14} />
            </button>
        </SimpleTooltip>
    </div>
);
