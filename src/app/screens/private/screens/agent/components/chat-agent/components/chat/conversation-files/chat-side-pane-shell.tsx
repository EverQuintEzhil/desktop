import { XIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { useChatShell } from '@/components/agent-chat/context/chat-shell-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';

interface Props {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
}

const MODAL_BREAKPOINT = 1280;

const ChatSidePaneShell = ({ isOpen, title, onClose, children }: Props) => {
    const { variant } = useChatShell();
    const [isViewportNarrow, setIsViewportNarrow] = useState(false);

    useEffect(() => {
        const checkIfShouldUseModal = () => {
            setIsViewportNarrow(window.innerWidth < MODAL_BREAKPOINT);
        };

        checkIfShouldUseModal();
        window.addEventListener('resize', checkIfShouldUseModal);

        return () => {
            window.removeEventListener('resize', checkIfShouldUseModal);
        };
    }, []);

    // The rail is a fixed 400px, so what matters is the width of the container it lands in, not
    // the viewport: the assistant panel is 340-640px however wide the window is.
    const isModalMode = variant === 'panel' || isViewportNarrow;

    if (isModalMode) {
        return (
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="flex max-w-[600px] flex-col overflow-hidden p-0 max-xl:max-h-[80svh] max-xl:rounded-2xl">
                    <DialogHeader className="flex flex-row items-center justify-between px-5 py-3.5">
                        <DialogTitle className="text-base font-semibold tracking-tight">{title}</DialogTitle>
                        <SimpleTooltip content="Close">
                            <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
                                <XIcon />
                            </Button>
                        </SimpleTooltip>
                    </DialogHeader>
                    <DialogBody className="scrollbar-controller scrollbar-vertical flex flex-col gap-6 p-5">
                        {children}
                    </DialogBody>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <div
            data-slot="chat-side-pane"
            data-state={isOpen ? 'open' : 'closed'}
            className={cn(
                'sticky top-0 h-svh shrink-0 overflow-hidden',
                'transition-[width] duration-300 ease-in-out',
                isOpen ? 'w-[400px]' : 'w-0',
            )}
        >
            <div
                className={cn(
                    'flex h-svh w-[400px] flex-col',
                    'border-l border-border bg-card',
                    'transition-transform duration-300 ease-in-out',
                    isOpen ? 'translate-x-0' : 'translate-x-full',
                )}
            >
                <div className="sticky top-0 z-1 flex items-center justify-between border-b border-border bg-card px-5 py-3.5">
                    <h4 className="text-base font-semibold tracking-tight text-foreground">{title}</h4>
                    <SimpleTooltip content="Close">
                        <Button variant="ghost" size="icon-xs" aria-label="Close" onClick={onClose}>
                            <XIcon />
                        </Button>
                    </SimpleTooltip>
                </div>
                <div className="scrollbar-controller scrollbar-vertical flex min-h-0 flex-1 flex-col gap-6 p-5">
                    {isOpen ? children : null}
                </div>
            </div>
        </div>
    );
};

export default ChatSidePaneShell;
