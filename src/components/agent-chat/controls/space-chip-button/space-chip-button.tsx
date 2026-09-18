import { FolderIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import './space-chip-button.scss';

interface Props {
    name: string;
    /** When provided, the chip is removable (folder icon swaps to ✕ on hover). Omit for a static, read-only chip. */
    onRemove?: () => void;
}

const SpaceChipButton = ({ name, onRemove }: Props) => {
    const readOnly = !onRemove;

    return (
        <Button
            className={cn(
                'space-chip-button h-8 rounded-full pr-3 pl-1',
                readOnly && 'read-only pointer-events-none cursor-default',
            )}
            variant="outline"
            onClick={onRemove}
            tabIndex={readOnly ? -1 : undefined}
            aria-label={readOnly ? `Current space ${name}` : `Remove space ${name}`}
        >
            <div className="icon-wrapper flex h-6 w-6 items-center justify-center rounded-circle">
                <FolderIcon className="folder-icon" />
                {!readOnly && <XIcon className="xmark-icon" />}
            </div>
            <span className="max-w-[160px] truncate text-xs">{name}</span>
        </Button>
    );
};

export default SpaceChipButton;
