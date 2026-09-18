import { XIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import {
    Sheet,
    SheetBody,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { shouldEscapeKeepDialogOpen } from '@/utils/escape-cancels-edit';

/**
 * Radix ports Popover/Select/etc. to body. Additionally, when modal Selects are open,
 * clicking the form hits body/focus-guard. We only want to close the SideSheet if the user
 * explicitly clicks the sheet's backdrop overlay.
 */
const isInteractOutsideOverlay = (event: Event) => {
    const detail = 'detail' in event ? event.detail : null;

    if (!detail || typeof detail !== 'object' || !('originalEvent' in detail)) {
        return false;
    }

    const { originalEvent } = detail as { originalEvent?: { target?: EventTarget | null } };
    const { target } = originalEvent || {};

    if (!(target instanceof Element)) {
        return false;
    }

    return Boolean(target.closest('[data-slot="sheet-overlay"]'));
};

export interface SideSheetProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    renderTitle?: () => React.ReactNode;
    renderFooter?: () => React.ReactNode;
    checkNestedArray?: string[];
    position?: 'left' | 'right';
    classNameContent?: string;
    classNameHeader?: string;
    classNameFooter?: string;
    styles?: string;
    showConfirmOnClose?: boolean;
}

const SideSheet = ({
    isOpen,
    onClose,
    renderTitle,
    children,
    renderFooter,
    checkNestedArray,
    position = 'right',
    styles = '',
    showConfirmOnClose = false,
    classNameContent = '',
    classNameHeader = '',
    classNameFooter = '',
}: SideSheetProps) => {
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const contentId = React.useId();

    const closeHandler = useCallback(() => {
        if (showConfirmOnClose) {
            setIsConfirmationModalOpen(true);
        } else {
            onClose();
        }
    }, [showConfirmOnClose, onClose]);

    const onConfirmClick = () => {
        setIsConfirmationModalOpen(false);
        onClose();
    };

    const closeConfirmModal = () => {
        setIsConfirmationModalOpen(false);
    };

    const hasOpenNestedElement = useCallback(() => {
        if (!checkNestedArray || checkNestedArray.length === 0) {
            return false;
        }

        return checkNestedArray.some((element) => document.getElementById(element));
    }, [checkNestedArray]);

    const handleEscapeKeyDown = useCallback(
        (e: KeyboardEvent) => {
            // A field inside the sheet may treat Escape as "cancel this edit" — a TipTap
            // slash/mention popup, for instance. Radix dismisses in the capture phase, so the
            // field marks itself and the sheet defers here instead of closing over unsaved work.
            if (shouldEscapeKeepDialogOpen(e)) {
                e.preventDefault();

                return;
            }

            if (hasOpenNestedElement()) {
                return;
            }

            e.preventDefault();
            closeHandler();
        },
        [closeHandler, hasOpenNestedElement],
    );

    const renderConfirmationModal = () => (
        <ConfirmationModal
            isOpen={isConfirmationModalOpen}
            onClose={() => closeConfirmModal()}
            onConfirm={() => onConfirmClick()}
            title="Close Confirmation"
            confirmButtonText="Confirm"
            cancelButtonText="Cancel"
        >
            <div className="mx-auto flex flex-col items-center justify-center text-center">
                <span className="text-sm">Are you sure you want to close? Your changes will not be saved.</span>
            </div>
        </ConfirmationModal>
    );

    return (
        <>
            <Sheet
                open={isOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        closeHandler();
                    }
                }}
            >
                <SheetContent
                    id={contentId}
                    side={position}
                    showCloseButton={false}
                    className={cn('flex w-full max-w-[380px] flex-col gap-0 p-0', 'sm:max-w-[380px]', styles)}
                    onInteractOutside={(e) => {
                        e.preventDefault();

                        const detail =
                            'detail' in e
                                ? (e as unknown as { detail?: { originalEvent?: PointerEvent } }).detail
                                : null;
                        const originalEvent = detail?.originalEvent;

                        // If the user clicked visually inside the SideSheet, ignore it.
                        // This happens when a Radix Select/Modal is open and sets pointer-events: none on the body,
                        // causing clicks in the form to fall through to the SheetOverlay.
                        if (originalEvent && 'clientX' in originalEvent) {
                            const { clientX, clientY } = originalEvent as PointerEvent;
                            const contentElement = document.getElementById(contentId);

                            if (contentElement) {
                                const rect = contentElement.getBoundingClientRect();

                                if (
                                    clientX >= rect.left &&
                                    clientX <= rect.right &&
                                    clientY >= rect.top &&
                                    clientY <= rect.bottom
                                ) {
                                    return;
                                }
                            }
                        }

                        if (isInteractOutsideOverlay(e)) {
                            closeHandler();
                        }
                    }}
                    onEscapeKeyDown={(e) => {
                        handleEscapeKeyDown(e);
                    }}
                >
                    <SheetTitle className="sr-only">Side panel</SheetTitle>
                    <SheetDescription className="sr-only">
                        Side panel with related fields and actions. Use Tab to move through controls.
                    </SheetDescription>
                    <SheetHeader
                        className={cn(
                            'sticky top-0 flex flex-row items-center justify-between border-b border-border bg-card px-4 py-2',
                            classNameHeader,
                        )}
                    >
                        <SheetClose asChild>
                            {/* Hidden close for accessibility; real close via our button */}
                            <span className="sr-only">Close</span>
                        </SheetClose>
                        <SheetTitle className="flex-1 text-sm font-medium">
                            {renderTitle ? renderTitle() : 'Default Title'}
                        </SheetTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full"
                            onClick={closeHandler}
                            aria-label="Close side sheet"
                        >
                            <XIcon className="h-4 w-4" />
                        </Button>
                    </SheetHeader>

                    <SheetBody className={cn('p-5', classNameContent)}>{children}</SheetBody>

                    {renderFooter && (
                        <SheetFooter
                            className={cn(
                                'sticky bottom-0 mt-0 border-t border-border bg-card px-4 py-2',
                                classNameFooter,
                            )}
                        >
                            {renderFooter()}
                        </SheetFooter>
                    )}
                </SheetContent>
            </Sheet>
            {renderConfirmationModal()}
        </>
    );
};

export default SideSheet;
