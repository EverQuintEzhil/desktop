import { ChevronRightIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { BreadcrumbItem } from '../../../../wizard-pages/configure-files-folders-step/types';

export interface FilesFoldersBreadcrumbProps {
    items: BreadcrumbItem[];
    isSubmitting: boolean;
    onNavigate: (segments: string[]) => void;
}

const FilesFoldersBreadcrumb = (props: FilesFoldersBreadcrumbProps) => {
    const { items, isSubmitting, onNavigate } = props;

    return (
        <nav
            className="configure-files-folders-breadcrumb flex flex-wrap items-center gap-1 text-sm"
            aria-label="Folder path"
        >
            {items.map((item, idx) => {
                const isLast = idx === items.length - 1;

                return (
                    <div key={item.pathSegments.join('/') || 'root'} className="flex min-w-0 items-center gap-1">
                        {idx > 0 && <ChevronRightIcon className="size-4 text-muted-foreground!" aria-hidden />}
                        <button
                            type="button"
                            className={cn(
                                'min-w-0 truncate rounded px-1 py-0.5 text-left transition-colors',
                                'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                isLast && 'font-medium text-foreground',
                                !isLast && 'text-muted-foreground hover:text-foreground',
                                isSubmitting ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                            )}
                            disabled={isSubmitting}
                            onClick={() => {
                                if (isSubmitting) return;
                                onNavigate(item.pathSegments);
                            }}
                            aria-current={isLast ? 'page' : undefined}
                            title={item.label}
                        >
                            {item.label}
                        </button>
                    </div>
                );
            })}
        </nav>
    );
};

export default FilesFoldersBreadcrumb;
