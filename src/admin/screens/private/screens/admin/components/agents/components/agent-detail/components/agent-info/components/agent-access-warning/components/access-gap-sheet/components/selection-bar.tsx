import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { NOTHING_SELECTABLE_REASON } from '../../../../../../agent-access/access-coverage';

interface Props {
    selectedCount: number;
    selectableCount: number;
    onToggleAll: (selected: boolean) => void;
    onGrant: () => void;
    /** The grant is on the wire: nothing has moved yet, so the button says so and takes no second click. */
    isPending: boolean;
}

/**
 * The header of a people list: select-all on the left, the bulk action on the right, laid out like
 * the Access tab's section header. A people list has no capability sections to carry the selection,
 * so it lives once above the rows; height is fixed so ticking a box never shifts the list.
 */
const SelectionBar = (props: Props) => {
    const { selectedCount, selectableCount, onToggleAll, onGrant, isPending } = props;

    const allSelected = selectedCount === selectableCount;

    return (
        <div className="selection-bar flex min-h-11 shrink-0 items-center gap-3 border-b border-border bg-muted px-4">
            {/* A disabled Radix control swallows the pointer, so the reason hangs off a wrapper. */}
            <SimpleTooltip content={selectableCount === 0 ? NOTHING_SELECTABLE_REASON : null}>
                <span className={cn('flex', selectableCount === 0 && 'cursor-not-allowed')}>
                    <Checkbox
                        className={cn('cursor-pointer', selectableCount === 0 && 'pointer-events-none')}
                        checked={allSelected && selectableCount > 0}
                        indeterminate={selectedCount > 0 && !allSelected}
                        disabled={selectableCount === 0}
                        label={selectedCount > 0 ? `${selectedCount} selected` : 'Select all missing'}
                        labelClassName="text-xs whitespace-nowrap text-text-secondary"
                        onChange={(_, checked) => onToggleAll(checked)}
                    />
                </span>
            </SimpleTooltip>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden">
                {selectedCount > 0 && (
                    <Button size="xs" disabled={isPending} onClick={onGrant}>
                        {isPending && <Spinner className="size-3.5" />}
                        Grant all
                    </Button>
                )}
            </span>
        </div>
    );
};

export default SelectionBar;
