import { ArrowLeftIcon, PlugIcon, XIcon } from 'lucide-react';

import { PickerDetailSkeleton } from '@/app/components/picker/picker-detail-skeleton';
import {
    actionBase,
    actionRemove,
    getItemAbbr,
    getItemColor,
    pickerFormWrapCls,
    type PickerItem,
} from '@/app/components/picker/picker-shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { btnCls, KIND_NOUN } from '../constants';

export interface CapabilityGenericDetailProps {
    selectedItem: PickerItem | null;
    selectTitle: string;
    description?: string;
    detailLoading: boolean;
    isEnabled: boolean;
    onToggle: () => void;
    onBack: () => void;
    onClose: () => void;
}

const renderEmptyState = (selectTitle: string, onClose: () => void) => (
    <>
        <div className="modal-agent-header sticky top-0 z-1 flex h-[80px] items-center gap-1 border-b border-border bg-card p-3">
            <div className="flex-1" />
            <Button variant="ghost" size="icon" className={btnCls} aria-label="Close" onClick={onClose}>
                <XIcon size={17} aria-hidden="true" />
            </Button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-text-secondary">
            <span
                className={cn(
                    'flex h-16 w-16 items-center justify-center rounded-[18px]',
                    'bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))] text-primary',
                    'border border-[color-mix(in_srgb,var(--primary)_14%,var(--border))]',
                )}
            >
                <PlugIcon size={24} aria-hidden="true" />
            </span>
            <h3 className="mt-0.5 text-[18px] font-semibold tracking-[-0.01em] text-(--text-primary)">{selectTitle}</h3>
            <p className="max-w-[300px] text-h6 leading-[1.6] text-text-secondary">
                Choose an item from the list to preview details and add it to this agent.
            </p>
        </div>
    </>
);

const CapabilityGenericDetail = ({
    selectedItem,
    selectTitle,
    description,
    detailLoading,
    isEnabled,
    onToggle,
    onBack,
    onClose,
}: CapabilityGenericDetailProps) => {
    if (!selectedItem) return renderEmptyState(selectTitle, onClose);

    const abbr = getItemAbbr(selectedItem.name);
    const color = getItemColor(selectedItem._id);
    const kindLabel = KIND_NOUN[selectedItem.kind];
    const subLine = description ? kindLabel : `Connected ${kindLabel}`;

    return (
        <>
            <div className="modal-agent-header sticky top-0 z-2 flex h-[80px] items-center gap-3 border-b border-border bg-card px-4 py-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn('sm:hidden', btnCls)}
                    aria-label="Back"
                    onClick={onBack}
                >
                    <ArrowLeftIcon size={17} aria-hidden="true" />
                </Button>
                <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-h4 font-bold text-white"
                    style={{ background: color }}
                >
                    {abbr}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <h3 className="truncate text-lg font-medium tracking-[-0.02em]">{selectedItem.name}</h3>
                    <span className="text-sm text-text-secondary">{subLine}</span>
                </div>
                <Button variant="ghost" size="icon" className={btnCls} aria-label="Close" onClick={onClose}>
                    <XIcon size={17} aria-hidden="true" />
                </Button>
            </div>
            <div className={cn('modal-agent-content w-full px-4 py-6', pickerFormWrapCls)}>
                {detailLoading ? (
                    <PickerDetailSkeleton hasServerUrl={false} />
                ) : (
                    <>
                        <Card className="flex flex-col gap-1 p-4 shadow-none">
                            <span className="text-[12px] font-bold tracking-[0.06em] text-(--text-primary) uppercase">
                                Overview
                            </span>
                            <p className="m-0 text-sm leading-[1.6] text-text-secondary">
                                {description ??
                                    'No description has been provided for this item yet. You can still add it and configure how your agent uses it.'}
                            </p>
                        </Card>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                            <Card className="flex flex-col gap-1 p-4 shadow-none">
                                <span className="text-xs font-semibold tracking-[0.06em] uppercase">Type</span>
                                <span className="text-sm text-text-secondary">{kindLabel}</span>
                            </Card>
                            <Card className="flex flex-col gap-1 p-4 shadow-none">
                                <span className="text-xs font-semibold tracking-[0.06em] uppercase">Status</span>
                                <span className="text-sm text-text-secondary">
                                    {isEnabled ? 'Enabled' : 'Available'}
                                </span>
                            </Card>
                        </div>
                    </>
                )}
            </div>
            <div className="modal-agent-footer sticky bottom-0 z-1 mt-auto border-t border-border bg-card p-4">
                <div className={pickerFormWrapCls}>
                    <button className={cn(actionBase, isEnabled && actionRemove)} onClick={onToggle}>
                        {isEnabled ? 'Remove' : 'Enable'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default CapabilityGenericDetail;
