import { CheckIcon, SettingsIcon, XIcon } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getLucideIcon } from '@/lib/icons/lucide-icons';
import { cn } from '@/lib/utils';
import type { ParameterTypeTextbox } from '@/types/admin';

interface Props {
    parameterKey: string;
    parameter: ParameterTypeTextbox & { label: string };
    value: string;
    isDarkMode?: boolean;
    editorMode?: 'popover' | 'dialog';
    autoOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    setParameter: (key: string, value: string) => void;
    removeParameter: (key: string) => void;
}

const ParameterTextboxSelector = ({
    parameterKey,
    parameter,
    value,
    isDarkMode = false,
    editorMode = 'popover',
    autoOpen = false,
    onOpenChange,
    setParameter,
    removeParameter,
}: Props) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [draft, setDraft] = React.useState(value);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const ParameterIcon = getLucideIcon(parameter.icon) ?? SettingsIcon;
    const isDialogMode = editorMode === 'dialog';

    const setEditorOpen = React.useCallback(
        (open: boolean) => {
            setIsOpen(open);
            onOpenChange?.(open);
        },
        [onOpenChange],
    );

    useEffect(() => {
        if (isOpen) {
            setDraft(value);
        }
    }, [isOpen, value]);

    useEffect(() => {
        if (autoOpen) {
            setEditorOpen(true);
        }
    }, [autoOpen, setEditorOpen]);

    const handleConfirm = () => {
        setParameter(parameterKey, draft);
        setEditorOpen(false);
    };

    const handleCancel = () => {
        setDraft(value);
        setEditorOpen(false);
    };

    const handleRemoveKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            removeParameter(parameterKey);
        }
    };

    const tooltipValue = value.trim();
    const hasValue = tooltipValue.length > 0;

    const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!isDialogMode) {
            return;
        }

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setEditorOpen(true);
        }
    };

    const renderTriggerLabel = () => (
        <div
            className={
                'flex h-full cursor-pointer items-center pr-3 pl-1.5 text-left text-xs font-medium select-none focus:outline-none'
            }
            role="button"
            tabIndex={isDialogMode ? 0 : -1}
            onClick={isDialogMode ? () => setEditorOpen(true) : undefined}
            onKeyDown={handleTriggerKeyDown}
        >
            {parameter.label}
            {hasValue && <span className="ml-1.5 inline-block size-1.5 shrink-0 rounded-full bg-primary" />}
        </div>
    );

    const renderPill = (trigger: React.ReactNode) => (
        <div
            className={cn(
                'selected-parameters inline-flex h-8 items-center gap-0 rounded-full border text-xs font-medium',
                isDarkMode
                    ? 'dark-mode border-transparent bg-black text-white'
                    : 'border-input bg-background text-primary',
                hasValue && 'ring-1 ring-primary/30',
            )}
        >
            <div
                className="icon-wrapper ml-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full"
                onClick={(e) => {
                    e.stopPropagation();
                    removeParameter(parameterKey);
                }}
                onKeyDown={handleRemoveKeyDown}
                role="button"
                tabIndex={0}
            >
                <ParameterIcon className={`globe-icon size-4 ${isDarkMode ? 'text-white!' : ''}`} />
                <XIcon className={`xmark-icon size-4 ${isDarkMode ? 'text-white!' : ''}`} />
            </div>
            {trigger}
        </div>
    );

    const renderTextarea = (className: string) => (
        <textarea
            ref={textareaRef}
            className={className}
            placeholder={'Describe what to exclude from the image...'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
        />
    );

    const focusTextareaEnd = () => {
        const textarea = textareaRef.current;

        if (!textarea) {
            return;
        }

        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    };

    if (isDialogMode) {
        return (
            <>
                {hasValue ? (
                    <Tooltip>
                        <TooltipTrigger asChild>{renderPill(renderTriggerLabel())}</TooltipTrigger>
                        <TooltipContent side="top" className="max-w-72 text-left wrap-break-word whitespace-pre-wrap">
                            {tooltipValue}
                        </TooltipContent>
                    </Tooltip>
                ) : (
                    renderPill(renderTriggerLabel())
                )}
                <Dialog
                    open={isOpen}
                    onOpenChange={(open) => {
                        if (!open) {
                            handleCancel();
                        } else {
                            setEditorOpen(true);
                        }
                    }}
                >
                    <DialogContent
                        className={cn(
                            'w-[calc(100%-2rem)] max-w-[560px] overflow-hidden p-0 max-md:flex max-md:h-svh max-md:max-h-svh max-md:w-[calc(100%)] max-md:max-w-full max-md:flex-col',
                            isDarkMode && 'dark-mode bg-black text-white',
                        )}
                        onOpenAutoFocus={(e) => {
                            e.preventDefault();
                            requestAnimationFrame(focusTextareaEnd);
                        }}
                    >
                        <DialogHeader className={`px-4 py-3 ${isDarkMode ? 'border-white/10' : ''}`}>
                            <DialogTitle className="text-base font-medium">{parameter.label}</DialogTitle>
                            <DialogDescription className="sr-only">
                                Edit the text for this selected parameter.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="px-4 py-4 max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col max-md:overflow-hidden max-md:py-3">
                            {renderTextarea(
                                cn(
                                    'max-h-[50dvh] min-h-[180px] w-full max-md:max-h-none max-md:min-h-0 sm:min-h-[220px] md:max-h-full',
                                    'resize-y rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none max-md:h-full max-md:flex-1 max-md:resize-none',
                                    'border-input bg-background placeholder:text-muted-foreground focus:border-primary focus:ring-0!',
                                    isDarkMode && 'border-white/20 bg-black text-white',
                                ),
                            )}
                        </div>
                        <DialogFooter
                            className={`justify-end border-t px-4 py-3 ${isDarkMode ? 'border-white/10 bg-white/5' : 'bg-muted/30'}`}
                        >
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={handleCancel}>
                                <XIcon className="size-3" />
                                Cancel
                            </Button>
                            <Button variant="default" size="sm" className="h-8 gap-1 text-xs" onClick={handleConfirm}>
                                <CheckIcon className="size-3" />
                                Apply
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </>
        );
    }

    return (
        <Popover
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) handleCancel();
                else setEditorOpen(true);
            }}
        >
            {renderPill(
                hasValue ? (
                    <Tooltip>
                        <PopoverTrigger asChild>
                            <TooltipTrigger asChild>{renderTriggerLabel()}</TooltipTrigger>
                        </PopoverTrigger>
                        <TooltipContent side="top" className="max-w-72 text-left wrap-break-word whitespace-pre-wrap">
                            {tooltipValue}
                        </TooltipContent>
                    </Tooltip>
                ) : (
                    <PopoverTrigger asChild>{renderTriggerLabel()}</PopoverTrigger>
                ),
            )}
            <PopoverContent
                sideOffset={8}
                align="center"
                side="top"
                className={`w-80 overflow-hidden p-0 ${isDarkMode ? 'dark-mode' : ''}`}
                onClick={(e) => e.stopPropagation()}
                onOpenAutoFocus={(e) => {
                    e.preventDefault();
                    textareaRef.current?.focus();
                }}
            >
                <div className="px-3 pt-3 pb-1">
                    <p className={`mb-2 text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-foreground'}`}>
                        {parameter.label}
                    </p>
                    {renderTextarea(
                        cn(
                            'h-28 w-full resize-none rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none',
                            'border-input bg-background placeholder:text-muted-foreground focus:ring-ring',
                        ),
                    )}
                </div>
                <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-3 py-2">
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleCancel}>
                        <XIcon className="size-3" />
                        Cancel
                    </Button>
                    <Button variant="default" size="sm" className="h-7 gap-1 text-xs" onClick={handleConfirm}>
                        <CheckIcon className="size-3" />
                        Apply
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default ParameterTextboxSelector;
