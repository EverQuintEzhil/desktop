import { RotateCwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Props {
    message?: string;
    onRetry: () => void;
    className?: string;
    iconClassName?: string;
}

const FileUploadRetryButton = ({ message, onRetry, className, iconClassName }: Props) => {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Retry upload"
                        className={cn('file-upload-retry-button shrink-0', className)}
                        onClick={(event) => {
                            event.stopPropagation();
                            onRetry();
                        }}
                    >
                        <RotateCwIcon className={cn('size-4 text-white!', iconClassName)} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{message || 'Upload failed. Click to retry.'}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

export default FileUploadRetryButton;
