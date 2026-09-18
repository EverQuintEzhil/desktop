import { XIcon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { useChatShell } from '@/components/agent-chat/context/chat-shell-context';
import type { ChatSource } from '@/components/agent-chat/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { sanitizeSourceDescription } from '@/lib/sanitize-html';
import { cn } from '@/lib/utils';

import './source-pane.scss';

interface Props {
    isVisible: boolean;
    isFromAdmin?: boolean;
    sources: ChatSource[];
    onClose: () => void;
}

const SourcePane = (props: Props) => {
    const { isVisible, sources, onClose, isFromAdmin } = props;
    const { variant } = useChatShell();
    const [isModalMode, setIsModalMode] = useState(false);
    const conversationPanelRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        // The rail is a fixed 400px, so what matters is the width of the container it lands in,
        // not the viewport: the assistant panel is 340-640px however wide the window is.
        if (isFromAdmin || variant === 'panel') {
            setIsModalMode(true);

            return;
        }
        const checkIfShouldUseModal = () => {
            if (window.innerWidth < 1280) {
                setIsModalMode(true);
            } else {
                setIsModalMode(false);
            }
        };

        checkIfShouldUseModal();

        const handleResize = () => {
            checkIfShouldUseModal();
        };

        let resizeObserver: ResizeObserver | null = null;

        if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(() => {
                checkIfShouldUseModal();
            });

            if (conversationPanelRef.current) {
                resizeObserver.observe(conversationPanelRef.current);
            }
        }

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (resizeObserver && conversationPanelRef.current) {
                resizeObserver.unobserve(conversationPanelRef.current);
            }
        };
    }, [isFromAdmin, variant]);

    const renderFavicon = (source: ChatSource) => {
        if (source.faviconUrl) {
            return <img src={source.faviconUrl} alt="favicon" />;
        }

        return null;
    };

    const renderSource = (source: ChatSource, index: number) => {
        return (
            <li
                key={source.url || source.title || source.description || `source-${index}`}
                className="source-list-item p-3"
            >
                <a
                    href={source.url ? source.url : '#'}
                    target={source.url ? '_blank' : undefined}
                    rel={source.url ? 'noopener noreferrer' : undefined}
                    className="flex flex-col gap-1"
                    onClick={(e) => {
                        if (!source.url) {
                            e.preventDefault();
                        }
                    }}
                >
                    <div className="source-meta flex items-center gap-2">
                        {renderFavicon(source)}
                        <span className="text-sm text-text-secondary">{source.siteName}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-(--text-primary)">{source.title || 'Untitled'}</span>
                        {source.description ? (
                            <p
                                className="line-clamp-2 text-sm text-text-secondary"
                                dangerouslySetInnerHTML={{
                                    __html: sanitizeSourceDescription(source.description),
                                }}
                            />
                        ) : null}
                    </div>
                </a>
            </li>
        );
    };

    const renderSourceContent = () => (
        <div className="source-pane-body">
            <ul className="source-list px-3 pt-2 pb-4 max-xl:px-1">
                {(sources?.length ?? 0) > 0 ? (
                    (sources ?? []).map((source, index) => renderSource(source, index))
                ) : (
                    <li className="source-list-item p-3">
                        <span className="text-sm">No sources available</span>
                    </li>
                )}
            </ul>
        </div>
    );

    if (isModalMode) {
        return (
            <Dialog open={isVisible} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="flex max-w-[600px] flex-col p-0 max-xl:max-h-[80svh] max-xl:rounded-2xl">
                    <DialogHeader className="flex flex-row items-center justify-between">
                        <DialogTitle>Sources ({sources?.length ?? 0})</DialogTitle>
                        <Button variant="ghost" size="icon-sm" onClick={onClose}>
                            <XIcon />
                        </Button>
                    </DialogHeader>
                    <DialogBody className="scrollbar-controller scrollbar-vertical p-0">
                        {renderSourceContent()}
                    </DialogBody>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <div
            className={cn(
                'sticky top-0 h-svh shrink-0 overflow-hidden',
                'transition-[width] duration-300 ease-in-out',
                isVisible ? 'w-[400px]' : 'w-0',
            )}
        >
            <div
                className={cn(
                    'source-pane-inner scrollbar-vertical scrollbar-controller flex h-svh w-[400px] flex-col',
                    'border-l border-border bg-card',
                    'transition-transform duration-300 ease-in-out',
                    isVisible ? 'translate-x-0' : 'translate-x-full',
                )}
            >
                <div className="source-pane-header sticky top-0 z-1 flex items-center justify-between border-b border-border bg-card px-6 py-3">
                    <h4 className="font-medium">Sources ({sources?.length ?? 0})</h4>
                    <Button variant="ghost" size="icon-sm" onClick={onClose}>
                        <XIcon />
                    </Button>
                </div>
                {renderSourceContent()}
            </div>
        </div>
    );
};

export default SourcePane;
