import { CheckIcon, CopyIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

const COPIED_RESET_MS = 2000;

export interface BlogCopyForLlmProps {
    title?: string;
    description?: string;
    content?: string;
}

// DOMParser builds an inert document, so markup in the body cannot fetch or run anything.
const htmlToText = (html: string): string =>
    (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();

const BlogCopyForLlm = (props: BlogCopyForLlmProps) => {
    const { title, description, content } = props;
    const [isCopied, setIsCopied] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleCopy = () => {
        if (!navigator.clipboard) {
            return;
        }

        const text = [title, description, content ? htmlToText(content) : '']
            .map((part) => part?.trim())
            .filter(Boolean)
            .join('\n\n');

        navigator.clipboard
            .writeText(text)
            .then(() => {
                setIsCopied(true);

                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }

                timeoutRef.current = setTimeout(() => setIsCopied(false), COPIED_RESET_MS);
            })
            .catch((error) => {
                console.error('Failed to copy the article', error);
            });
    };

    return (
        <Button variant="outline" className="blog-copy-for-llm gap-2" onClick={handleCopy}>
            {isCopied ? <CheckIcon /> : <CopyIcon />}
            {isCopied ? 'Copied' : 'Copy for LLM'}
        </Button>
    );
};

export default BlogCopyForLlm;
