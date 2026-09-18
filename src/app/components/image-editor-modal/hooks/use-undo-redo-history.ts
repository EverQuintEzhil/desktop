import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useEditorContext } from '../context/editor-context';
import type { EditorStateSnapshot } from '../types';

export const useUndoRedoHistory = () => {
    const {
        cropState,
        setCropState,
        adjustments,
        setAdjustments,
        adjustmentsEnabled,
        setAdjustmentsEnabled,
        selectedFilterId,
        setSelectedFilterId,
        filterIntensity,
        setFilterIntensity,
        filterEnabled,
        setFilterEnabled,
    } = useEditorContext();

    const createSnapshot = useCallback((): EditorStateSnapshot => {
        return {
            selectedFilterId,
            filterIntensity,
            filterEnabled,
            adjustments: cloneDeep(adjustments),
            adjustmentsEnabled,
            crop: cloneDeep(cropState),
        };
    }, [selectedFilterId, filterIntensity, filterEnabled, adjustments, adjustmentsEnabled, cropState]);

    const applySnapshot = useCallback(
        (snapshot: EditorStateSnapshot) => {
            setSelectedFilterId(snapshot.selectedFilterId);
            setFilterIntensity(snapshot.filterIntensity);
            setFilterEnabled(snapshot.filterEnabled);
            setAdjustments(cloneDeep(snapshot.adjustments));
            setAdjustmentsEnabled(snapshot.adjustmentsEnabled);
            setCropState(cloneDeep(snapshot.crop));
        },
        [
            setSelectedFilterId,
            setFilterIntensity,
            setFilterEnabled,
            setAdjustments,
            setAdjustmentsEnabled,
            setCropState,
        ],
    );

    const isSameSnapshot = useCallback((a: EditorStateSnapshot, b: EditorStateSnapshot): boolean => {
        return isEqual(a, b);
    }, []);

    const [history, setHistory] = useState<EditorStateSnapshot[]>([]);
    const [redoStack, setRedoStack] = useState<EditorStateSnapshot[]>([]);

    const canUndo = history.length > 0;
    const canRedo = redoStack.length > 0;

    const recordSnapshot = useCallback(() => {
        const snapshot = createSnapshot();

        setHistory((prev) => {
            const last = prev[prev.length - 1];

            if (last && isSameSnapshot(last, snapshot)) {
                return prev;
            }

            return [...prev, snapshot];
        });
        setRedoStack([]);
    }, [createSnapshot, isSameSnapshot]);

    const undo = useCallback(() => {
        setHistory((prev) => {
            if (!prev.length) return prev;

            const nextHistory = [...prev];
            const current = createSnapshot();

            // An entry equal to the live state is dead: a cancelled edit writes its pre-edit
            // value back, so the snapshot it recorded would restore the state the user is
            // already in and the shortcut would look broken.
            while (nextHistory.length && isSameSnapshot(nextHistory[nextHistory.length - 1], current)) {
                nextHistory.pop();
            }

            const lastSnapshot = nextHistory.pop();

            if (lastSnapshot) {
                setRedoStack((redoPrev) => [current, ...redoPrev]);
                applySnapshot(lastSnapshot);
            }

            return nextHistory;
        });
    }, [applySnapshot, createSnapshot, isSameSnapshot]);

    const redo = useCallback(() => {
        setRedoStack((prev) => {
            if (!prev.length) return prev;

            const [nextSnapshot, ...rest] = prev;

            const current = createSnapshot();

            setHistory((historyPrev) => {
                const last = historyPrev[historyPrev.length - 1];

                return last && isSameSnapshot(last, current) ? historyPrev : [...historyPrev, current];
            });
            applySnapshot(nextSnapshot);

            return rest;
        });
    }, [applySnapshot, createSnapshot, isSameSnapshot]);

    const resetHistory = useCallback(() => {
        setHistory([]);
        setRedoStack([]);
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            const isInputFocused =
                target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

            if ((event.metaKey || event.ctrlKey) && event.key === 'z' && !event.shiftKey) {
                if (isInputFocused) {
                    return;
                }

                event.preventDefault();
                if (canUndo) {
                    undo();
                    toast.info('Undo applied', {
                        closeButton: false,
                        duration: 1000,
                    });
                }
            }

            if ((event.metaKey || event.ctrlKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
                if (isInputFocused) {
                    return;
                }

                event.preventDefault();
                if (canRedo) {
                    redo();
                    toast.info('Redo applied', {
                        closeButton: false,
                        duration: 1000,
                    });
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [canUndo, canRedo, undo, redo]);

    return useMemo(
        () => ({
            history,
            redoStack,
            canUndo,
            canRedo,
            recordSnapshot,
            undo,
            redo,
            resetHistory,
        }),
        [canRedo, canUndo, history, recordSnapshot, redo, redoStack, resetHistory, undo],
    );
};
