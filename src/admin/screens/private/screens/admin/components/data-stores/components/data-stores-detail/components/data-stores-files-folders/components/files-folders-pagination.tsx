import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

export interface FilesFoldersPaginationProps {
    currentPage: number;
    hasNextPage: boolean;
    isSubmitting: boolean;
    onPrevPage: () => void;
    onNextPage: () => void;
}

const FilesFoldersPagination = (props: FilesFoldersPaginationProps) => {
    const { currentPage, hasNextPage, isSubmitting, onPrevPage, onNextPage } = props;

    return (
        <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={currentPage === 0 || isSubmitting}
                onClick={onPrevPage}
            >
                <ChevronLeftIcon className="size-4" />
                Prev
            </Button>
            <span className="text-xs text-muted-foreground">
                {'Page '}
                {currentPage + 1}
            </span>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!hasNextPage || isSubmitting}
                onClick={onNextPage}
            >
                Next
                <ChevronRightIcon className="size-4" />
            </Button>
        </div>
    );
};

export default FilesFoldersPagination;
