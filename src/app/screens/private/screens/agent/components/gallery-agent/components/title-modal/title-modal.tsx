import { CheckIcon, CopyIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

import './title-modal.scss';

interface TitleModalProps {
    isOpen: boolean;
    title: string;
    onClose: () => void;
}

const TitleModal = ({ isOpen, title, onClose }: TitleModalProps) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopyText = async () => {
        try {
            await navigator.clipboard.writeText(title);
            setIsCopied(true);
            setTimeout(() => {
                setIsCopied(false);
            }, 3000);
        } catch (error) {
            console.error('Failed to copy text:', error);
        }
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent
                overlayClassName="title-modal-overlay"
                className="title-modal title-modal-content scrollbar-controller scrollbar-vertical flex max-h-[70vh] w-[80%] max-w-2xl flex-col rounded-3xl bg-[#1f1f1f] shadow-dark"
            >
                <DialogTitle className="sr-only">Title</DialogTitle>
                <div className="title-modal-header flex items-center justify-end px-6 py-4">
                    <Button variant="black" size="icon-sm" className="ml-auto rounded-full" onClick={onClose}>
                        <XIcon />
                    </Button>
                </div>
                <div className="title-modal-body flex-1 px-6">
                    <span className="text-(--white)">{title}</span>
                </div>
                <div className="title-modal-footer flex items-center justify-end gap-3 px-6 py-4">
                    <Button variant="black" onClick={handleCopyText} className="ml-auto rounded-full">
                        {isCopied ? <CheckIcon /> : <CopyIcon />}
                        Copy
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default TitleModal;
