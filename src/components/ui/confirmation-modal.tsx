import { type LucideIcon, XIcon } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import Spinner from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ButtonConfig {
    text: string;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    /** Legacy colour alias — mapped to variant automatically */
    color?: 'primary' | 'subtle' | 'danger';
    icon?: LucideIcon;
    onClick: () => void;
    loading?: boolean;
    disabled?: boolean;
    title?: string;
}

type BaseProps = {
    /** Controls visibility */
    isOpen: boolean;
    /** Additional classes forwarded to DialogContent */
    styles?: string;
    /** Additional classes forwarded to the backdrop */
    overlayClassName?: string;
    /** Title text */
    title?: string;
    /** Simple string message shown in the body */
    message?: string;
    /** Custom body content (takes precedence over message when both absent) */
    children?: React.ReactNode;
    /** Custom title renderer */
    renderTitle?: () => React.ReactNode;
    /** Called when the dialog is closed (overlay click, Escape, Cancel) */
    onClose: () => void;
};

/** Default cancel/confirm buttons */
type DefaultButtonsProps = BaseProps & {
    buttons?: never;
    onConfirm: () => void;
    isButtonLoading?: boolean;
    confirmButtonText?: string;
    cancelButtonText?: string;
};

/** Fully custom button array */
type CustomButtonsProps = BaseProps & {
    buttons: ButtonConfig[];
    onConfirm?: never;
    isButtonLoading?: never;
    confirmButtonText?: never;
    cancelButtonText?: never;
};

export type ConfirmationModalProps = DefaultButtonsProps | CustomButtonsProps;

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Radix portals every dialog into the same container, so stacking is pure z-index.
 * A confirmation is always the topmost blocking prompt: it must clear the base dialog
 * tier (overlay 50 / content 51) and the nested-modal tier (60) used by the pickers,
 * otherwise its backdrop paints *under* the dialog that opened it and nothing dims.
 */
const CONFIRMATION_OVERLAY_Z = 'z-70';
const CONFIRMATION_CONTENT_Z = 'z-71';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVariant(
    color?: string,
    variant?: string,
): 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' {
    if (variant) return variant as 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    if (color === 'danger') return 'destructive';
    if (color === 'subtle') return 'secondary';

    return 'default';
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Confirmation modal built on **`Dialog`** (not Alert Dialog) so overlay / Escape dismiss
 * works as users expect; still uses **`role="alertdialog"`** for accessibility on blocking prompts.
 *
 * Same props as before: discriminated union for default vs custom buttons.
 */
const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    styles = '',
    overlayClassName = '',
    onClose,
    onConfirm,
    title,
    message,
    children,
    renderTitle: renderTitleProp,
    confirmButtonText = 'Confirm',
    cancelButtonText = 'Cancel',
    isButtonLoading = false,
    buttons,
}) => {
    const renderContent = () => {
        if (typeof message === 'string') {
            return (
                <DialogDescription className="mx-auto text-center text-base leading-[1.43] font-normal text-foreground">
                    {message}
                </DialogDescription>
            );
        }

        if (children) {
            return (
                <DialogDescription asChild>
                    <div className="flex w-full flex-col items-center text-center">{children}</div>
                </DialogDescription>
            );
        }

        return (
            <DialogDescription className="sr-only">
                {typeof title === 'string' && title.trim().length > 0 ? title : 'Please confirm or cancel this dialog.'}
            </DialogDescription>
        );
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && onClose) onClose();
            }}
        >
            <DialogContent
                role="alertdialog"
                overlayClassName={cn(CONFIRMATION_OVERLAY_Z, overlayClassName)}
                className={cn('w-[95%] max-w-[480px] p-0 sm:w-full', CONFIRMATION_CONTENT_Z, styles)}
            >
                {(title || renderTitleProp) && (
                    <DialogHeader className="flex-row items-center justify-between p-4">
                        <DialogTitle className="text-base font-medium">
                            {renderTitleProp ? renderTitleProp() : title}
                        </DialogTitle>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Close Confirmation Modal"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                            }}
                        >
                            <XIcon />
                        </Button>
                    </DialogHeader>
                )}

                <div className="flex flex-col items-center px-4 py-6 text-center">{renderContent()}</div>

                <DialogFooter className="confirmation-modal-footer flex flex-row items-center justify-center gap-3 border-t border-none p-4 sm:justify-center">
                    {buttons ? (
                        buttons.map((button, index) => (
                            <Button
                                key={`${button.text}-${index}`}
                                type="button"
                                variant={getVariant(button.color, button.variant)}
                                disabled={button.loading || button.disabled}
                                title={button.title}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    button.onClick();
                                }}
                                size="sm"
                                className="rounded-full"
                            >
                                {button.loading && <Spinner className="mr-2" />}
                                {!button.loading && button.icon ? <button.icon /> : null}
                                {button.text}
                            </Button>
                        ))
                    ) : (
                        <>
                            <Button
                                variant="secondary"
                                type="button"
                                className="rounded-full font-normal"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                }}
                            >
                                {cancelButtonText}
                            </Button>
                            <Button
                                variant="default"
                                type="button"
                                className="rounded-full font-normal"
                                disabled={isButtonLoading}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onConfirm!();
                                }}
                            >
                                {isButtonLoading && <Spinner className="mr-2" />}
                                {confirmButtonText}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ConfirmationModal;
