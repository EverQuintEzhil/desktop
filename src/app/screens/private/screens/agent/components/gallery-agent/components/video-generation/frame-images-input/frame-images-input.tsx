import { ArrowRightLeftIcon, ImagePlusIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { useRef, useState } from 'react';

import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { FileType } from '@/types/chat';

import type { FrameSlot } from './use-frame-images';

const ACCEPT = 'image/jpg,image/jpeg,image/png,image/gif,image/webp';

interface Props {
    first: FileType | null;
    last: FileType | null;
    disabled?: boolean;
    onSelect: (slot: FrameSlot, file: File) => void;
    onRemove: (slot: FrameSlot) => void;
    onSwap: () => void;
}

const slotLabels: Record<FrameSlot, string> = {
    first: 'First frame',
    last: 'Last frame',
};

const FrameImagesInput = ({ first, last, disabled, onSelect, onRemove, onSwap }: Props) => {
    const firstInputRef = useRef<HTMLInputElement>(null);
    const lastInputRef = useRef<HTMLInputElement>(null);
    const [dragSlot, setDragSlot] = useState<FrameSlot | null>(null);

    const inputRefs: Record<FrameSlot, React.RefObject<HTMLInputElement | null>> = {
        first: firstInputRef,
        last: lastInputRef,
    };

    const canSwap = Boolean(first) || Boolean(last);

    const openPicker = (slot: FrameSlot) => {
        if (disabled) return;

        inputRefs[slot].current?.click();
    };

    const handleFileChange = (slot: FrameSlot) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (file) onSelect(slot, file);

        event.target.value = '';
    };

    const handleDragOver = (event: React.DragEvent) => {
        if (disabled) return;

        event.preventDefault();
    };

    const handleDragEnter = (slot: FrameSlot) => (event: React.DragEvent) => {
        if (disabled) return;

        event.preventDefault();
        setDragSlot(slot);
    };

    const handleDragLeave = (slot: FrameSlot) => (event: React.DragEvent) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;

        setDragSlot((current) => (current === slot ? null : current));
    };

    const handleDrop = (slot: FrameSlot) => (event: React.DragEvent) => {
        event.preventDefault();
        setDragSlot(null);

        if (disabled) return;

        const file = event.dataTransfer.files?.[0];

        if (file?.type.startsWith('image/')) onSelect(slot, file);
    };

    const dragHandlers = (slot: FrameSlot) => ({
        onDragOver: handleDragOver,
        onDragEnter: handleDragEnter(slot),
        onDragLeave: handleDragLeave(slot),
        onDrop: handleDrop(slot),
    });

    const renderEmpty = (slot: FrameSlot) => (
        <button
            type="button"
            disabled={disabled}
            onClick={() => openPicker(slot)}
            aria-label={`Add ${slotLabels[slot].toLowerCase()}`}
            {...dragHandlers(slot)}
            className={cn(
                'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl',
                'border border-dashed border-border bg-muted/30 text-muted-foreground',
                'transition-colors hover:border-primary/60 hover:bg-primary/5 hover:text-primary',
                dragSlot === slot && 'border-primary bg-primary/10 text-primary',
                'disabled:cursor-not-allowed disabled:opacity-50',
            )}
        >
            <ImagePlusIcon className="size-[18px]" />
        </button>
    );

    const renderFilled = (slot: FrameSlot, file: FileType) => (
        <div
            {...dragHandlers(slot)}
            className={cn(
                'group relative size-11 shrink-0 overflow-hidden rounded-xl border border-border ring-1 ring-border/40',
                dragSlot === slot && 'ring-2 ring-primary',
            )}
        >
            <img src={file.url} alt={slotLabels[slot]} className="size-full object-cover" />
            {dragSlot === slot ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/25 text-primary-foreground">
                    <ImagePlusIcon className="size-4" />
                </div>
            ) : null}
            {file.isUploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                    <Spinner className="size-4 text-primary" />
                </div>
            ) : null}
            {file.uploadError ? (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => openPicker(slot)}
                    aria-label={`Retry ${slotLabels[slot].toLowerCase()} upload`}
                    className="absolute inset-0 flex cursor-pointer items-center justify-center bg-background/85 text-destructive"
                >
                    <TriangleAlertIcon className="size-4" />
                </button>
            ) : null}
            <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(slot)}
                aria-label={`Remove ${slotLabels[slot].toLowerCase()}`}
                className={cn(
                    'absolute top-1 right-1 flex size-[18px] cursor-pointer items-center justify-center rounded-full',
                    'bg-background/95 text-foreground shadow-sm ring-1 ring-border/50',
                    'opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100',
                    'hover:bg-background disabled:cursor-not-allowed disabled:opacity-50',
                )}
            >
                <XIcon className="size-3" />
            </button>
        </div>
    );

    const renderSlot = (slot: FrameSlot, file: FileType | null) => (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{file ? renderFilled(slot, file) : renderEmpty(slot)}</TooltipTrigger>
                <TooltipContent>{slotLabels[slot]}</TooltipContent>
            </Tooltip>
            <input
                ref={inputRefs[slot]}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={handleFileChange(slot)}
            />
        </TooltipProvider>
    );

    return (
        <div className="flex items-center gap-1.5 px-0.5 pt-1 pb-2">
            {renderSlot('first', first)}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            disabled={disabled || !canSwap}
                            onClick={onSwap}
                            aria-label="Swap first and last frames"
                            className={cn(
                                'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full',
                                'text-muted-foreground transition-colors',
                                'hover:bg-muted hover:text-foreground',
                                'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
                            )}
                        >
                            <ArrowRightLeftIcon className="size-4" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>Swap frames</TooltipContent>
                </Tooltip>
            </TooltipProvider>
            {renderSlot('last', last)}
        </div>
    );
};

export default FrameImagesInput;
