import { OctagonAlertIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

export interface Props {
    onRetry: () => void;
}

const PromptDetailError = (props: Props) => {
    const { onRetry } = props;

    return (
        <div className="flex min-h-[80svh] items-center justify-center px-4">
            <div className="flex max-w-sm flex-col items-center justify-center gap-4 text-center">
                <OctagonAlertIcon className="size-10 text-destructive" />
                <div className="flex flex-col items-center justify-center gap-2">
                    <h3 className="text-xl font-medium text-(--text-primary)">Failed to Load Prompt</h3>
                    <span className="text-sm text-text-secondary">Network issue or prompt doesn&apos;t exist</span>
                    <Button type="button" className="mt-2 min-w-[120px] justify-center rounded-full" onClick={onRetry}>
                        Retry
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default PromptDetailError;
