import { ArrowLeftIcon, ChevronRightIcon, FolderTreeIcon, TablePropertiesIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import Switch from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import type { BreadcrumbItem, ExplorerViewMode } from '../types';

export interface ExplorerToolbarProps {
    viewMode: ExplorerViewMode;
    onViewModeChange: (mode: ExplorerViewMode) => void;
    isSubmitting: boolean;
    canGoUp: boolean;
    onGoBack: () => void;
    selectedKeysSize: number;
    breadcrumbItems: BreadcrumbItem[];
    onNavigateToPath: (segments: string[]) => void;
}

const ExplorerToolbar = ({
    viewMode,
    onViewModeChange,
    isSubmitting,
    canGoUp,
    onGoBack,
    selectedKeysSize,
    breadcrumbItems,
    onNavigateToPath,
}: ExplorerToolbarProps) => {
    const renderSelectionSummary = () => (
        <span className="text-xs text-muted-foreground sm:text-sm">
            {selectedKeysSize}
            {' path'}
            {selectedKeysSize === 1 ? '' : 's'}
            {' selected'}
        </span>
    );

    const renderLeadingControls = () => {
        if (viewMode === 'browse') {
            return (
                <>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={!canGoUp || isSubmitting}
                        onClick={onGoBack}
                        aria-label="Go up one folder"
                    >
                        <ArrowLeftIcon className="size-4" />
                        Back
                    </Button>
                    {renderSelectionSummary()}
                </>
            );
        }

        return renderSelectionSummary();
    };

    const renderBreadcrumb = () => {
        if (viewMode !== 'browse') return null;

        return (
            <nav
                className="configure-files-folders-breadcrumb flex flex-wrap items-center gap-1 text-sm"
                aria-label="Folder path"
            >
                {breadcrumbItems.map((item, idx) => {
                    const isLast = idx === breadcrumbItems.length - 1;

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
                                    onNavigateToPath(item.pathSegments);
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

    return (
        <div className="flex flex-col gap-3 border-b border-border pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">{renderLeadingControls()}</div>
                <div className="inline-flex shrink-0 items-center" role="group" aria-label="Explorer view mode">
                    <Switch
                        options={[
                            { label: 'Browse', icon: TablePropertiesIcon },
                            { label: 'Tree', icon: FolderTreeIcon },
                        ]}
                        activeIndex={viewMode === 'browse' ? 0 : 1}
                        onChange={(_event, index) => {
                            if (isSubmitting) return;
                            onViewModeChange(index === 0 ? 'browse' : 'tree');
                        }}
                        width={100}
                    />
                </div>
            </div>
            {renderBreadcrumb()}
        </div>
    );
};

export default ExplorerToolbar;
