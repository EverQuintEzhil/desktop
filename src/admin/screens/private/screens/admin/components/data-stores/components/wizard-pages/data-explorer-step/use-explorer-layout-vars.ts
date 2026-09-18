import { type RefObject, useEffect } from 'react';

export const useExplorerLayoutVars = (
    stepRef: RefObject<HTMLDivElement | null>,
    isSplitView: boolean,
    showMethodVariantSwitch: boolean,
    // The step root only mounts (with stepRef) once firstLoading clears; gate on `ready`
    // and include it in the deps so the effect re-runs then. Without it the effect's only
    // run happens during the loading placeholder (ref null) and never measures again.
    ready: boolean,
): void => {
    // Dynamically derives two CSS custom properties on the step root element:
    //
    //  --explorer-query-h     : max-height for the full-json query field (Pipeline editor).
    //                           = stepH − method-switch − view-switch − statusbar
    //                             − 200px (minimum useful results area) − flex gaps.
    //                           Set unconditionally so the first ResizeObserver tick can
    //                           already constrain the pipeline editor before results reflow.
    //
    //  --explorer-available-h : max-height for the results table / JSON editor.
    //                           = #explorer-results-panel.height − #explorer-statusbar.height.
    //                           #explorer-results-panel is flex-1, so its height already
    //                           accounts for all chrome above it (wizard shell + explorer toolbar).
    useEffect(() => {
        if (!ready) return;

        const step = stepRef.current;

        if (!step) return;

        let rafRetryId = 0;

        const clearExplorerSizeVars = () => {
            step.style.removeProperty('--explorer-available-h');
            step.style.removeProperty('--explorer-query-h');
            step.style.removeProperty('--explorer-split-query-h');
            step.style.removeProperty('--explorer-split-results-h');
            step.style.removeProperty('--explorer-split-pane-h');
        };

        const updateAvailableH = (layoutRetryDepth = 0) => {
            const panel = step.querySelector<HTMLElement>('#explorer-results-panel');
            const statusbar = step.querySelector<HTMLElement>('#explorer-statusbar');
            const viewSwitch = step.querySelector<HTMLElement>('#explorer-view-switch');
            const methodSwitch = step.querySelector<HTMLElement>('#explorer-method-switch');
            const queryBody = step.querySelector<HTMLElement>('#explorer-query-body');
            const resultsBody = step.querySelector<HTMLElement>('.data-explorer-results-body');

            const stepH = step.getBoundingClientRect().height;
            const methodSwitchH = methodSwitch?.getBoundingClientRect().height ?? 0;
            const viewSwitchH = viewSwitch?.getBoundingClientRect().height ?? 0;
            const statusbarH = statusbar?.getBoundingClientRect().height ?? 40;

            if (isSplitView) {
                step.style.removeProperty('--explorer-query-h');

                // ── Split pane height (≥md) ───────────────────────────────────────
                // Size the pane to the real space below it instead of a guessed px
                // offset: pane top → viewport bottom (detail tab), or → where the
                // wizard nav footer pins at the dialog bottom (wizard). pane.top and
                // the dialog bottom are stable even while the pane currently overflows,
                // so this converges in one pass and adapts to breadcrumb/tab wrapping.
                const pane = step.querySelector<HTMLElement>('.data-explorer-split-pane');

                if (pane) {
                    const footer = document.getElementById('ds-wiz-navigation');
                    const BOTTOM_GAP = 24;
                    let bottomRef: number;

                    if (footer) {
                        const dialog = footer.closest<HTMLElement>('[role="dialog"]');
                        const dialogBottom = dialog ? dialog.getBoundingClientRect().bottom : window.innerHeight;

                        bottomRef = dialogBottom - footer.getBoundingClientRect().height - BOTTOM_GAP;
                    } else {
                        const dialog = pane.closest<HTMLElement>('[role="dialog"]');

                        if (dialog) {
                            const modalFooter = dialog.querySelector<HTMLElement>('.modal-agent-footer');
                            const dialogBottom = dialog.getBoundingClientRect().bottom;
                            const footerH = modalFooter ? modalFooter.getBoundingClientRect().height : 0;

                            bottomRef = dialogBottom - footerH - BOTTOM_GAP;
                        } else {
                            bottomRef = window.innerHeight - BOTTOM_GAP;
                        }
                    }

                    const paneH = Math.round(bottomRef - pane.getBoundingClientRect().top);

                    if (paneH > 200) {
                        step.style.setProperty('--explorer-split-pane-h', `${paneH}px`);
                    } else {
                        step.style.removeProperty('--explorer-split-pane-h');
                    }
                }

                const queryBodyH = queryBody?.getBoundingClientRect().height ?? 0;
                const resultsBodyH = resultsBody?.getBoundingClientRect().height ?? 0;

                if (queryBodyH > 40) {
                    step.style.setProperty('--explorer-split-query-h', `${Math.round(queryBodyH)}px`);
                } else {
                    step.style.removeProperty('--explorer-split-query-h');
                }

                if (resultsBodyH > 40) {
                    step.style.setProperty('--explorer-split-results-h', `${Math.round(resultsBodyH)}px`);
                    step.style.setProperty('--explorer-available-h', `${Math.round(resultsBodyH)}px`);
                } else {
                    step.style.removeProperty('--explorer-split-results-h');
                    step.style.removeProperty('--explorer-available-h');
                }

                if ((queryBodyH < 40 || resultsBodyH < 40) && layoutRetryDepth < 8) {
                    cancelAnimationFrame(rafRetryId);
                    rafRetryId = requestAnimationFrame(() => {
                        updateAvailableH(layoutRetryDepth + 1);
                    });
                }

                return;
            }

            step.style.removeProperty('--explorer-split-query-h');
            step.style.removeProperty('--explorer-split-results-h');

            // ── Query field (Pipeline editor) ──────────────────────────────────
            if (stepH > 0) {
                // gap-3 (12px) fires between every pair of visible flex children in the step.
                // children: [method-switch?] + query-bar + view-switch + results-panel
                const gapCount = methodSwitchH > 0 ? 3 : 2;
                const RESULTS_MIN = 200; // px — keep results area usable
                const queryH = Math.max(
                    160,
                    Math.round(stepH - methodSwitchH - viewSwitchH - statusbarH - RESULTS_MIN - gapCount * 12),
                );

                step.style.setProperty('--explorer-query-h', `${queryH}px`);
            }

            // ── Results area (table / JSON editor) ────────────────────────────
            if (!panel) {
                step.style.removeProperty('--explorer-available-h');

                return;
            }

            const panelH = panel.getBoundingClientRect().height;

            // After Find ↔ Aggregate, the first frame can report ~0 height. Do not keep the
            // previous --explorer-available-h from split view (it is much larger and blows
            // up the Find layout + scroll). Drop to CSS fallbacks and remeasure next frame.
            if (panelH < 40) {
                step.style.removeProperty('--explorer-available-h');
                if (layoutRetryDepth < 8) {
                    cancelAnimationFrame(rafRetryId);
                    rafRetryId = requestAnimationFrame(() => {
                        updateAvailableH(layoutRetryDepth + 1);
                    });
                }

                return;
            }

            step.style.setProperty('--explorer-available-h', `${Math.max(80, Math.round(panelH - statusbarH))}px`);
        };

        const ro = new ResizeObserver(() => {
            updateAvailableH(0);
        });

        ro.observe(step);

        const observedBodies = [
            step.querySelector<HTMLElement>('#explorer-query-body'),
            step.querySelector<HTMLElement>('.data-explorer-results-body'),
        ].filter((el): el is HTMLElement => el != null);

        for (const el of observedBodies) {
            ro.observe(el);
        }

        updateAvailableH(0);

        return () => {
            cancelAnimationFrame(rafRetryId);
            ro.disconnect();
            clearExplorerSizeVars();
        };
    }, [isSplitView, showMethodVariantSwitch, ready]);
};
