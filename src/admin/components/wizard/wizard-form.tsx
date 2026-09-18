import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import SpinnerBlade from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import './wizard.scss';

/**
 * Exposed via ref on each wizard page. `submitStep` runs validation + save when applicable;
 * resolve to `true` only when the step completed successfully and the shell should advance.
 * Optional `handleFooterPrev`: return `true` when the page handled Previous (e.g. internal substep)
 * and the shell should not change wizard page.
 */
export interface WizardFormPageHandle {
    submitStep: () => Promise<boolean>;
    handleFooterPrev?: () => boolean;
}

export interface WizardFormPageProps {
    /** Zero-based index of the currently active page. */
    currentPage: number;
    /** Total number of pages in the wizard. */
    totalPages: number;
    /** True when the current page is the first page. */
    isFirst: boolean;
    /** True when the current page is the last page. */
    isLast: boolean;
    /** Advance to the next page (or call onComplete on the last page). */
    goToNext: () => void;
    /** Go back to the previous page. */
    goToPrev: () => void;
    /** Jump directly to any page by index. */
    goToPage: (page: number) => void;
    onPageComplete?: (data: object | null, pageInfo?: { currentPage: number; method: 'POST' | 'PUT' }) => void;
    /**
     * Updates per-page readiness for the footer Next/Complete button. When false, the footer
     * Next control is disabled (in addition to any parent `canGoNext` lock).
     */
    setCanGoNext: (value: boolean) => void;
    canGoNext: boolean;
    commonData?: object | null;
    handleCommonDataChange?: (value: object | null) => void;
}

export interface WizardFormPage {
    id: string;
    title: string;
    description?: string;
    /**
     * Initial value for `canGoNext` passed to the page (`setCanGoNext` / `defaultCanGoNext`).
     * When `lockFooterToPageCanGoNext` is true, the footer Next is also disabled until the page
     * calls `setCanGoNext(true)`. Defaults to true.
     */
    defaultCanGoNext?: boolean;
    /**
     * When true, the shell footer Next/Complete is disabled while `pageCanGoNext` is false.
     * Other pages rely on `submitStep()` only (footer stays clickable). Use for sub-flows that
     * must block the shell control (e.g. embedding vs metadata substeps).
     */
    lockFooterToPageCanGoNext?: boolean;
    /**
     * Page body: must be `forwardRef` and implement `WizardFormPageHandle` (see `submitStep`).
     */
    component: ForwardRefExoticComponent<WizardFormPageProps & RefAttributes<WizardFormPageHandle>>;
}

export interface WizardFormProps {
    pages: WizardFormPage[];
    /** Controlled: current page index owned by the parent. */
    currentPage: number;
    /** Called when the wizard wants to advance (parent should increment currentPage). */
    onNext: () => void;
    /** Called when the wizard wants to go back (parent should decrement currentPage). */
    onPrev: () => void;
    /** Called instead of onNext when the user advances past the last page. */
    onComplete?: () => void;
    /** Called whenever any navigation occurs, with the target page index. */
    onPageChange?: (page: number) => void;
    onPageComplete?: (data: object | null, pageInfo?: { currentPage: number; method: 'POST' | 'PUT' }) => void;
    /**
     * Controlled shared data passed to every page component. Update it from
     * the parent via onCommonDataChange (called whenever a page writes to it).
     */
    commonData?: object | null;
    /**
     * Called whenever a page calls handleCommonDataChange. The parent should
     * update its own state and pass the new value back through commonData.
     */
    onCommonDataChange?: (data: object | null) => void;
    /**
     * When false, the footer Next/Complete chevron is disabled (e.g. parent-level lock).
     */
    canGoNext?: boolean;
    /**
     * When set, `goToPage` jumps in one step instead of calling `onNext`/`onPrev` in a loop
     * (avoids redundant parent updates).
     */
    onGoToPage?: (page: number) => void;
    loading?: boolean;
    className?: string;
}

export const WizardForm = ({
    pages,
    currentPage,
    onNext,
    onPrev,
    onComplete,
    onPageChange,
    commonData = null,
    onPageComplete,
    onCommonDataChange,
    canGoNext: parentCanGoNext = true,
    onGoToPage,
    loading = false,
    className = '',
}: WizardFormProps) => {
    const totalPages = pages.length;
    const isFirst = currentPage === 0;
    const isLast = currentPage === totalPages - 1;
    const currentPageData = pages[currentPage];

    const [pageCanGoNext, setPageCanGoNextState] = useState(currentPageData?.defaultCanGoNext ?? true);

    const setPageCanGoNext = useCallback((value: boolean) => {
        setPageCanGoNextState(value);
    }, []);

    const pageRef = useRef<WizardFormPageHandle | null>(null);

    const nextSubmitLockRef = useRef(false);

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setIsSubmitting(false);
        nextSubmitLockRef.current = false;
    }, [currentPage]);

    useEffect(() => {
        setPageCanGoNextState(pages[currentPage]?.defaultCanGoNext ?? true);
    }, [currentPage, pages]);

    const handleCommonDataChange = (value: object | null) => {
        onCommonDataChange?.(value);
    };

    const goToNext = () => {
        if (isLast) {
            onComplete?.();
        } else {
            onNext();
            onPageChange?.(currentPage + 1);
        }
    };

    const handleWizardNextClick = () => {
        if (isSubmitting || nextSubmitLockRef.current) return;
        nextSubmitLockRef.current = true;
        setIsSubmitting(true);
        void (async () => {
            try {
                const ok = await pageRef.current?.submitStep();

                if (ok) {
                    goToNext();
                }
            } catch (err) {
                console.error(err);
            } finally {
                nextSubmitLockRef.current = false;
                setIsSubmitting(false);
            }
        })();
    };

    const goToPrev = () => {
        if (!isFirst) {
            onPrev();
            onPageChange?.(currentPage - 1);
        }
    };

    const handleWizardPrevClick = () => {
        const consumed = pageRef.current?.handleFooterPrev?.();

        if (consumed) return;
        goToPrev();
    };

    const goToPage = useCallback(
        (page: number) => {
            if (page < 0 || page >= totalPages) return;

            if (onGoToPage) {
                onGoToPage(page);
                onPageChange?.(page);

                return;
            }

            const diff = page - currentPage;

            if (diff > 0) {
                for (let i = 0; i < diff; i++) onNext();
            } else if (diff < 0) {
                for (let i = 0; i < Math.abs(diff); i++) onPrev();
            }

            onPageChange?.(page);
        },
        [currentPage, onGoToPage, onNext, onPageChange, onPrev, totalPages],
    );

    const pageProps: WizardFormPageProps = {
        currentPage,
        totalPages,
        isFirst,
        isLast,
        goToNext,
        goToPrev,
        goToPage,
        onPageComplete,
        canGoNext: pageCanGoNext,
        setCanGoNext: setPageCanGoNext,
        commonData,
        handleCommonDataChange,
    };

    if (loading) {
        return (
            <div className={cn('w-full min-w-0', className)}>
                <Card className="w-full min-w-0 rounded-lg border-0 text-inherit shadow-none">
                    <CardContent className="flex flex-col gap-6 p-6">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-4 w-16" />
                            <div className="flex flex-1 gap-1">
                                <Skeleton className="h-1 flex-1 rounded-full" />
                                <Skeleton className="h-1 flex-1 rounded-full" />
                                <Skeleton className="h-1 flex-1 rounded-full" />
                            </div>
                        </div>
                        <Skeleton className="h-6 w-2/3" />
                        <Skeleton className="h-64 w-full rounded-md" />
                        <div className="flex justify-center gap-2">
                            <Skeleton className="size-11 rounded-full" />
                            <Skeleton className="size-11 rounded-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!currentPageData) return null;

    const PageComponent = currentPageData.component as ForwardRefExoticComponent<
        WizardFormPageProps & RefAttributes<WizardFormPageHandle>
    >;

    return (
        <div className={cn('wizard-form flex min-h-0 w-full min-w-0 flex-1 flex-col', className)}>
            <div className="wizard-form-container relative flex min-h-0 w-full min-w-0 flex-1 flex-col p-4">
                <div className="wizard-form-content flex min-h-0 min-w-0 flex-1 flex-col gap-6 pb-2">
                    <div id="ds-wiz-step-indicator" className="wizard-form-step-indicator flex shrink-0 flex-col gap-3">
                        <span className="jetbrains-mono text-sm leading-none font-medium tracking-widest text-primary uppercase">
                            Step {currentPage + 1}/{totalPages}
                        </span>
                        <div className="wizard-form-step-indicator-progress flex gap-1">
                            {pages.map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-1 flex-1 rounded-full transition-colors ${i <= currentPage ? 'bg-primary' : 'bg-muted'}`}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="wizard-form-step-content flex min-h-0 flex-1 flex-col gap-4">
                        <div
                            id="ds-wiz-step-content-header"
                            className="wizard-form-step-content-header flex shrink-0 flex-col gap-1"
                        >
                            <h4 className="text-xl font-semibold">{currentPageData.title}</h4>
                            {currentPageData.description && (
                                <span className="text-sm text-secondary">{currentPageData.description}</span>
                            )}
                        </div>
                        <div className="wizard-form-step-body scrollbar-controller scrollbar-vertical flex min-h-0 min-w-0 flex-1 flex-col">
                            <PageComponent ref={pageRef} {...pageProps} />
                        </div>
                    </div>
                </div>

                <div
                    id="ds-wiz-navigation"
                    className="wizard-form-navigation mt-auto flex shrink-0 items-center justify-end gap-2"
                >
                    <Button
                        variant="outline"
                        size="icon-lg"
                        onClick={handleWizardPrevClick}
                        disabled={isFirst}
                        aria-label="Previous step"
                    >
                        <ChevronLeftIcon />
                    </Button>
                    <Button
                        size="icon-lg"
                        onClick={handleWizardNextClick}
                        disabled={
                            !parentCanGoNext ||
                            (Boolean(currentPageData.lockFooterToPageCanGoNext) && !pageCanGoNext) ||
                            isSubmitting
                        }
                        aria-busy={isSubmitting}
                        aria-label={isLast ? 'Complete' : 'Next step'}
                    >
                        {isSubmitting ? <SpinnerBlade /> : <ChevronRightIcon />}
                    </Button>
                </div>
            </div>
        </div>
    );
};
