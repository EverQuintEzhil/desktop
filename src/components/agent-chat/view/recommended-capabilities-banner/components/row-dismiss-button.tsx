import { X as XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { TRAILING_SLOT_CLASSES } from '../constants';

interface Props {
    /** Names the row this dismisses, so the two buttons are distinguishable to a screen reader. */
    label: string;
    onDismiss: () => void;
}

const RowDismissButton = ({ label, onDismiss }: Props) => (
    <span className={TRAILING_SLOT_CLASSES}>
        <Button
            size="icon-xs"
            variant="ghost"
            aria-label={label}
            className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            onClick={onDismiss}
        >
            <XIcon className="size-3.5" />
        </Button>
    </span>
);

export default RowDismissButton;
