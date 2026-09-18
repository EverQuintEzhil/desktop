import { CheckIcon, CopyIcon, LinkIcon } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';
import { showErrorToast, showSuccessToast } from '@/utils';

export interface CopyButtonProps {
    text: string;
    size?: 'small' | 'regular' | 'large';
    onCopy?: () => void;
    className?: string;
    buttonType?: 'text' | 'default';
    tooltipContent?: string;
    tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
    ariaLabel?: string;
}

const CopyButton = (props: CopyButtonProps) => {
    const { text, onCopy, className, tooltipContent, tooltipSide = 'bottom', ariaLabel } = props;

    const [isCopied, setIsCopied] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        e.preventDefault();

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        navigator.clipboard
            .writeText(text)
            .then(() => {
                setIsCopied(true);
                if (onCopy) {
                    onCopy();
                }
                timeoutRef.current = setTimeout(() => {
                    setIsCopied(false);
                }, 3000);
            })
            .catch((error) => {
                console.error('Failed to copy to clipboard', error);
            });
    };

    const button = (
        <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleCopy}
            aria-label={ariaLabel}
            className={`ml-auto${className ? ` ${className}` : ''}`}
        >
            {isCopied ? <CheckIcon /> : <CopyIcon />}
        </Button>
    );

    return (
        <SimpleTooltip content={tooltipContent} side={tooltipSide}>
            {button}
        </SimpleTooltip>
    );
};

export default CopyButton;

export interface CopyLinkButtonProps {
    url: string;
    className?: string;
}

export const CopyLinkButton = ({ url, className }: CopyLinkButtonProps) => {
    const [copied, setCopied] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cooldownRef = useRef(false);

    useEffect(
        () => () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        },
        [],
    );

    const handleCopy = () => {
        if (cooldownRef.current) return;
        cooldownRef.current = true;

        navigator.clipboard
            .writeText(url)
            .then(() => {
                setCopied(true);
                showSuccessToast('Link copied to clipboard');
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => {
                    setCopied(false);
                    cooldownRef.current = false;
                }, 2000);
            })
            .catch(() => {
                cooldownRef.current = false;
                showErrorToast('Failed to copy link');
            });
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            aria-live="polite"
            className={cn(
                'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5',
                'text-sm font-medium text-primary transition-colors hover:bg-primary/15',
                'outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:ring-offset-2',
                className,
            )}
        >
            {copied ? <CheckIcon className="size-3.5" /> : <LinkIcon className="size-3.5" />}
            {copied ? 'Copied' : 'Copy link'}
        </button>
    );
};
