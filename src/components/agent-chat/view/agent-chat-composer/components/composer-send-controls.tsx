import { ComposerPrimitive, useAuiState } from '@assistant-ui/react';
import { ArrowUpIcon, SquareIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { useAgentComposerContext } from '../../../context/agent-composer-context';

export interface SendButtonProps {
    canSubmit: boolean;
    onSubmit: () => void;
}

export const SendButton = ({ canSubmit, onSubmit }: SendButtonProps) => {
    return (
        <Button
            size="icon-sm"
            variant="outline"
            className="button-send justify-center rounded-full"
            disabled={!canSubmit}
            onClick={onSubmit}
            aria-label="Send message"
        >
            <ArrowUpIcon />
        </Button>
    );
};

export const RunningSendControl = ({ canSubmit, onSubmit }: SendButtonProps) => {
    const isRunning = useAuiState((s) => s.thread.isRunning);
    const { onStopGeneration } = useAgentComposerContext();

    if (isRunning && !canSubmit) {
        return (
            <ComposerPrimitive.Cancel asChild>
                <Button
                    size="icon-sm"
                    variant="outline"
                    className="button-send justify-center rounded-full"
                    aria-label="Stop generating"
                    onClick={onStopGeneration}
                >
                    <SquareIcon className="size-3 fill-current" />
                </Button>
            </ComposerPrimitive.Cancel>
        );
    }

    return <SendButton canSubmit={canSubmit} onSubmit={onSubmit} />;
};
