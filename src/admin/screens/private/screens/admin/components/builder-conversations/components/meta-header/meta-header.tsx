import { RefreshCwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface Props {
    messages: unknown[];
    conversationId: string;
    onRefresh?: () => void;
}

const MetaHeader = (props: Props) => {
    const { messages, conversationId, onRefresh } = props;

    return (
        <div className="sticky top-0 z-2 flex h-[50px] items-center justify-end gap-2 border-b border-border-secondary bg-card px-2 py-1">
            <Button
                size="sm"
                variant="outline"
                className="h-7 rounded-full px-2 text-(length:--text-xs)"
                onClick={onRefresh}
                aria-label="Refresh messages"
            >
                <RefreshCwIcon className="size-3" />
                Refresh
            </Button>
            <Button
                size="sm"
                className="h-7 rounded-full px-2 text-(length:--text-xs)"
                onClick={() => {
                    const data = JSON.stringify(messages || []);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');

                    a.href = url;
                    a.download = `conversation-${conversationId}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }}
            >
                Export
            </Button>
        </div>
    );
};

export default MetaHeader;
