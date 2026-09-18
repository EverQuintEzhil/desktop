import { PlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { CapabilityRow } from '../types';

export interface CapabilityRowItemProps {
    row: CapabilityRow;
    onOpenDetail: (technical: string) => void;
}

const CapabilityRowItem = ({ row, onOpenDetail }: CapabilityRowItemProps) => {
    const RowIcon = row.Icon;

    return (
        <div className="flex items-start gap-4 border-b border-border py-[18px] last:border-b-0">
            <button
                type="button"
                onClick={() => onOpenDetail(row.technical)}
                aria-label={`About ${row.technical}`}
                className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] bg-background"
            >
                <RowIcon className="size-[17px] text-primary" aria-hidden="true" />
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold">{row.title}</span>
                    <span className="text-xs text-text-secondary">{row.technical}</span>
                </div>
                <div className="text-[13px] text-text-secondary">{row.help}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                    {row.chips}
                    <Button variant="ghost" size="sm" className="rounded-full px-3.5" onClick={row.onAdd}>
                        <PlusIcon className="size-3.5" aria-hidden="true" />
                        {row.addLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CapabilityRowItem;
