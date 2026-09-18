import { CodeXmlIcon, EyeIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';

import type { ArtifactViewMode } from './artifact-types';

const ITEM_CLASS_NAME = 'size-7 rounded-md text-muted-foreground hover:bg-card hover:text-foreground';

const ACTIVE_CLASS_NAME = 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground';

interface ArtifactViewToggleProps {
    view: ArtifactViewMode;
    onViewChange: (view: ArtifactViewMode) => void;
}

export const ArtifactViewToggle = ({ view, onViewChange }: ArtifactViewToggleProps) => (
    <div className="artifact-view-toggle flex shrink-0 items-center gap-0.5 rounded-lg bg-muted p-0.5">
        <SimpleTooltip content="Preview" side="bottom">
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(ITEM_CLASS_NAME, view === 'preview' && ACTIVE_CLASS_NAME)}
                aria-label="Preview"
                aria-pressed={view === 'preview'}
                onClick={() => onViewChange('preview')}
            >
                <EyeIcon aria-hidden="true" />
            </Button>
        </SimpleTooltip>
        <SimpleTooltip content="Source" side="bottom">
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(ITEM_CLASS_NAME, view === 'code' && ACTIVE_CLASS_NAME)}
                aria-label="Source"
                aria-pressed={view === 'code'}
                onClick={() => onViewChange('code')}
            >
                <CodeXmlIcon aria-hidden="true" />
            </Button>
        </SimpleTooltip>
    </div>
);
