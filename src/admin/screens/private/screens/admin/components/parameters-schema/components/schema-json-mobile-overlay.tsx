import { ChevronLeftIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SchemaJsonMobileOverlayProps {
    showJson: boolean;
    onClose: () => void;
    renderJsonField: () => ReactNode;
}

/** Slide-in JSON overlay shown on tablet/mobile in place of the two-pane desktop layout. */
const SchemaJsonMobileOverlay = ({ showJson, onClose, renderJsonField }: SchemaJsonMobileOverlayProps) => (
    <div
        className={cn(
            'absolute inset-0 z-20 flex flex-col bg-card lg:hidden',
            'transition-transform duration-300 ease-in-out',
            showJson ? 'translate-x-0' : 'pointer-events-none translate-x-full',
        )}
    >
        <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-3 py-2">
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-text-secondary" onClick={onClose}>
                <ChevronLeftIcon className="size-4" />
                Properties
            </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-4">{renderJsonField()}</div>
    </div>
);

export default SchemaJsonMobileOverlay;
