import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
    Pagination as UIPagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

interface Props {
    count: number;
    page: number;
    onChange: (page: number) => void;
    disabled?: boolean;
}

const Pagination = (props: Props) => {
    const { count, page, onChange, disabled } = props;

    const handlePageChange = (newPage: number) => {
        if (newPage < 1 || newPage > count) return;
        onChange(newPage);
    };

    const renderPageButton = (pageNumber: number) => (
        <PaginationItem key={`page-${pageNumber}`}>
            <Button
                type="button"
                variant={pageNumber === page ? 'outline' : 'ghost'}
                size="icon"
                className={cn(
                    'h-8 w-auto min-w-8 rounded-pill border border-border-secondary px-2 tabular-nums',
                    // The outline variant carries `dark:bg-input/30`, and a dark: rule outranks a
                    // plain one — so the active fill has to be declared at the same level.
                    pageNumber === page &&
                        'border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground ' +
                            'dark:border-primary dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary',
                )}
                aria-current={pageNumber === page ? 'page' : undefined}
                aria-label={`Go to page ${pageNumber}`}
                disabled={disabled}
                onClick={() => handlePageChange(pageNumber)}
            >
                {pageNumber}
            </Button>
        </PaginationItem>
    );

    const renderPages = () => {
        const pages: ReactNode[] = [];
        const maxVisiblePages = 3; // Number of pages to show around the current page

        if (count <= 7) {
            // If pages are few, show all
            for (let i = 1; i <= count; i++) {
                pages.push(renderPageButton(i));
            }
        } else {
            // Always show first page
            pages.push(renderPageButton(1));

            if (page > maxVisiblePages + 2) {
                pages.push(
                    <PaginationItem key="dots-left">
                        <PaginationEllipsis className="size-8" />
                    </PaginationItem>,
                );
            }

            // Show range around current page
            for (let i = Math.max(2, page - maxVisiblePages); i <= Math.min(count - 1, page + maxVisiblePages); i++) {
                pages.push(renderPageButton(i));
            }

            if (page < count - maxVisiblePages - 1) {
                pages.push(
                    <PaginationItem key="dots-right">
                        <PaginationEllipsis className="size-8" />
                    </PaginationItem>,
                );
            }

            // Always show last page
            pages.push(renderPageButton(count));
        }

        return pages;
    };

    return (
        <UIPagination className="mr-0 ml-auto w-auto justify-end">
            <PaginationContent className="flex-wrap gap-2">
                <PaginationItem>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8 rounded-pill bg-card"
                        aria-label="Go to first page"
                        disabled={page === 1 || disabled}
                        onClick={() => handlePageChange(1)}
                    >
                        <ChevronsLeftIcon className="size-5" />
                    </Button>
                </PaginationItem>
                <PaginationItem>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8 rounded-pill bg-card"
                        aria-label="Go to previous page"
                        disabled={page === 1 || disabled}
                        onClick={() => handlePageChange(page - 1)}
                    >
                        <ChevronLeftIcon className="size-5" />
                    </Button>
                </PaginationItem>
                {renderPages()}
                <PaginationItem>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8 rounded-pill bg-card"
                        aria-label="Go to next page"
                        disabled={page === count || disabled || count === 0}
                        onClick={() => handlePageChange(page + 1)}
                    >
                        <ChevronRightIcon className="size-5" />
                    </Button>
                </PaginationItem>
                <PaginationItem>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8 rounded-pill bg-card"
                        aria-label="Go to last page"
                        disabled={page === count || disabled || count === 0}
                        onClick={() => handlePageChange(count)}
                    >
                        <ChevronsRightIcon className="size-5" />
                    </Button>
                </PaginationItem>
            </PaginationContent>
        </UIPagination>
    );
};

export default Pagination;
