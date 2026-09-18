import { ArrowLeftIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { useChatShell } from '../context/chat-shell-context';

/**
 * Explicit "Back to builder" control shown only inside the builder's "Try it out"
 * preview. Renders nothing in the real app chat, where `isPreview` is false and no
 * `onExit` is provided.
 */
const PreviewBackButton = () => {
    const { isPreview, onExit } = useChatShell();

    if (!isPreview || !onExit) {
        return null;
    }

    return (
        <Button
            type="button"
            variant="outline"
            size="xs"
            className="shrink-0 rounded-full"
            onClick={onExit}
            aria-label="Back to builder"
        >
            <ArrowLeftIcon className="size-3.5" />
            <span className="max-lg:hidden">Back to builder</span>
        </Button>
    );
};

export default PreviewBackButton;
