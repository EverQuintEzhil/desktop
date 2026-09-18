import React from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

import './edit-prompt-overlay.scss';

export interface EditPromptOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    parameterSelectPopupStyles?: string;
    parameterStepperPopupStyles?: string;
    parameterButtonStyles?: string;
}

const EditPromptOverlay = (props: EditPromptOverlayProps) => {
    const {
        isOpen,
        onClose,
        children,
        parameterSelectPopupStyles,
        parameterStepperPopupStyles,
        parameterButtonStyles,
    } = props;

    const hasOverrides =
        parameterSelectPopupStyles != null || parameterStepperPopupStyles != null || parameterButtonStyles != null;
    const content = hasOverrides
        ? React.Children.map(children, (child) => {
              if (React.isValidElement(child)) {
                  const childProps = child.props as {
                      parameterSelectPopupStyles?: string;
                      parameterStepperPopupStyles?: string;
                      parameterButtonStyles?: string;
                  };
                  const extra = {
                      parameterSelectPopupStyles: parameterSelectPopupStyles ?? childProps.parameterSelectPopupStyles,
                      parameterStepperPopupStyles:
                          parameterStepperPopupStyles ?? childProps.parameterStepperPopupStyles,
                      parameterButtonStyles: parameterButtonStyles ?? childProps.parameterButtonStyles,
                  };

                  return React.cloneElement(child, extra as Record<string, unknown>);
              }

              return child;
          })
        : children;

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent
                overlayClassName="edit-prompt-overlay is-open"
                className="edit-prompt-content max-w-[640px]! rounded-3xl border-0 p-0 shadow-none"
            >
                <DialogTitle className="sr-only">Edit prompt</DialogTitle>
                {content}
            </DialogContent>
        </Dialog>
    );
};

export default EditPromptOverlay;
