import { useAui } from '@assistant-ui/react';
import { TextQuote } from 'lucide-react';
import { createContext, useContext, useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';

export interface SelectionQuoteContextValue {
    pendingQuote: string | null;
    setPendingQuote: (text: string) => void;
    clearPendingQuote: () => void;
}

const SelectionQuoteContext = createContext<SelectionQuoteContextValue | null>(null);

export const SelectionQuoteProvider = SelectionQuoteContext.Provider;

export const useSelectionQuoteContext = (): SelectionQuoteContextValue | null => {
    return useContext(SelectionQuoteContext);
};

interface SelectionQuoteProps {
    containerRef: RefObject<HTMLDivElement | null>;
    disabled?: boolean;
}

interface SelectionPillState {
    text: string;
    top: number;
    left: number;
}

const PILL_VERTICAL_OFFSET = 40;
const PILL_VIEWPORT_MARGIN = 8;
const PILL_HORIZONTAL_CLAMP = 60;

export const buildQuoteMarkdown = (text: string): string => {
    const quotedLines = text
        .trim()
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');

    return `${quotedLines}\n\n`;
};

export const SelectionQuote = ({ containerRef, disabled = false }: SelectionQuoteProps) => {
    const quoteContext = useSelectionQuoteContext();
    const aui = useAui();
    const [pill, setPill] = useState<SelectionPillState | null>(null);

    useEffect(() => {
        if (disabled) {
            setPill(null);

            return undefined;
        }

        const readSelection = () => {
            const container = containerRef.current;
            const selection = window.getSelection();

            if (!container || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
                setPill(null);

                return;
            }

            const text = selection.toString().trim();

            if (!text) {
                setPill(null);

                return;
            }

            const range = selection.getRangeAt(0);
            const ancestor = range.commonAncestorContainer;
            const element = ancestor instanceof Element ? ancestor : ancestor.parentElement;

            if (element?.closest('[data-selectable-message]') !== container) {
                setPill(null);

                return;
            }

            const rect = range.getBoundingClientRect();

            setPill({
                text,
                top: Math.max(rect.top - PILL_VERTICAL_OFFSET, PILL_VIEWPORT_MARGIN),
                left: Math.min(
                    Math.max(rect.left + rect.width / 2, PILL_HORIZONTAL_CLAMP),
                    window.innerWidth - PILL_HORIZONTAL_CLAMP,
                ),
            });
        };

        const handleSelectionChange = () => {
            window.requestAnimationFrame(readSelection);
        };

        const handleScroll = () => {
            setPill(null);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setPill(null);
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        document.addEventListener('mouseup', handleSelectionChange);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('scroll', handleScroll, true);

        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
            document.removeEventListener('mouseup', handleSelectionChange);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [containerRef, disabled]);

    const handleQuoteClick = () => {
        if (!pill) return;

        if (quoteContext) {
            quoteContext.setPendingQuote(pill.text);
        } else {
            const composer = aui.thread.composer();
            const currentText = composer.getState().text;
            const quote = buildQuoteMarkdown(pill.text);

            composer.setText(currentText.trim() ? `${currentText}\n${quote}` : quote);
        }

        window.getSelection()?.removeAllRanges();
        setPill(null);
    };

    if (!pill) return null;

    return createPortal(
        <Button
            size="sm"
            variant="secondary"
            className="fixed z-50 -translate-x-1/2 rounded-lg hover:bg-primary hover:text-primary-foreground"
            style={{ top: pill.top, left: pill.left }}
            onPointerDown={(event) => event.preventDefault()}
            onClick={handleQuoteClick}
            aria-label="Ask about selected text"
        >
            <TextQuote className="size-3.5" />
            Ask
        </Button>,
        document.body,
    );
};
