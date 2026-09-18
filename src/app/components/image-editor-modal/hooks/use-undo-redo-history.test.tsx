import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import IntensityControl from '../components/intensity-control/intensity-control';
import { EditorProvider, useEditorContext } from '../context/editor-context';

import { useUndoRedoHistory } from './use-undo-redo-history';

const wrapper = ({ children }: { children: ReactNode }) => <EditorProvider>{children}</EditorProvider>;

const useProbe = () => ({
    editor: useEditorContext(),
    history: useUndoRedoHistory(),
});

const renderProbe = () => renderHook(useProbe, { wrapper });

const pressKey = (key: string, options: KeyboardEventInit = {}, target: EventTarget = document.body) => {
    act(() => {
        target.dispatchEvent(
            new KeyboardEvent('keydown', {
                key,
                bubbles: true,
                cancelable: true,
                ...options,
            }),
        );
    });
};

describe('useUndoRedoHistory', () => {
    it('starts with nothing to undo or redo', () => {
        const { result } = renderProbe();

        expect(result.current.history.canUndo).toBe(false);
        expect(result.current.history.canRedo).toBe(false);
        expect(result.current.history.history).toEqual([]);
    });

    it('restores the recorded snapshot on undo', () => {
        const { result } = renderProbe();

        act(() => result.current.history.recordSnapshot());
        act(() => result.current.editor.setFilterIntensity(40));

        expect(result.current.editor.filterIntensity).toBe(40);
        expect(result.current.history.canUndo).toBe(true);

        act(() => result.current.history.undo());

        expect(result.current.editor.filterIntensity).toBe(100);
        expect(result.current.history.canUndo).toBe(false);
        expect(result.current.history.canRedo).toBe(true);
    });

    it('re-applies the undone state on redo', () => {
        const { result } = renderProbe();

        act(() => result.current.history.recordSnapshot());
        act(() => result.current.editor.setSelectedFilterId('sepia'));
        act(() => result.current.history.undo());

        expect(result.current.editor.selectedFilterId).toBeNull();

        act(() => result.current.history.redo());

        expect(result.current.editor.selectedFilterId).toBe('sepia');
        expect(result.current.history.canRedo).toBe(false);
        expect(result.current.history.canUndo).toBe(true);
    });

    it('ignores a snapshot identical to the previous one', () => {
        const { result } = renderProbe();

        act(() => result.current.history.recordSnapshot());
        act(() => result.current.history.recordSnapshot());

        expect(result.current.history.history).toHaveLength(1);

        act(() => result.current.editor.setFilterEnabled(false));
        act(() => result.current.history.recordSnapshot());

        expect(result.current.history.history).toHaveLength(2);
    });

    it('skips a snapshot that already matches the live state', () => {
        const { result } = renderProbe();

        act(() => result.current.history.recordSnapshot());
        act(() => result.current.editor.setFilterIntensity(40));
        act(() => result.current.history.recordSnapshot());

        expect(result.current.history.history).toHaveLength(2);

        pressKey('z', { metaKey: true });

        expect(result.current.editor.filterIntensity).toBe(100);
        expect(result.current.history.history).toEqual([]);
        expect(result.current.history.redoStack).toHaveLength(1);
    });

    it('drains a history of nothing but dead snapshots without a redo entry', () => {
        const { result } = renderProbe();

        act(() => result.current.history.recordSnapshot());

        act(() => result.current.history.undo());

        expect(result.current.history.history).toEqual([]);
        expect(result.current.history.redoStack).toEqual([]);
        expect(result.current.editor.filterIntensity).toBe(100);
    });

    it('clears the redo stack when a new snapshot is recorded', () => {
        const { result } = renderProbe();

        act(() => result.current.history.recordSnapshot());
        act(() => result.current.editor.setFilterIntensity(20));
        act(() => result.current.history.undo());

        expect(result.current.history.canRedo).toBe(true);

        act(() => result.current.history.recordSnapshot());

        expect(result.current.history.canRedo).toBe(false);
    });

    it('drops both stacks on resetHistory', () => {
        const { result } = renderProbe();

        act(() => result.current.history.recordSnapshot());
        act(() => result.current.editor.setFilterIntensity(10));
        act(() => result.current.history.undo());
        act(() => result.current.history.resetHistory());

        expect(result.current.history.canUndo).toBe(false);
        expect(result.current.history.canRedo).toBe(false);
    });

    it('does nothing when undo or redo is called with empty stacks', () => {
        const { result } = renderProbe();

        act(() => result.current.history.undo());
        act(() => result.current.history.redo());

        expect(result.current.history.history).toEqual([]);
        expect(result.current.history.redoStack).toEqual([]);
        expect(result.current.editor.filterIntensity).toBe(100);
    });

    it('deep-clones adjustments so an undo is not aliased to live state', () => {
        const { result } = renderProbe();

        act(() => result.current.history.recordSnapshot());
        act(() => result.current.editor.updateAdjustments({ vignette: { size: 5, amount: 7 } }));

        expect(result.current.editor.adjustments.vignette).toEqual({ size: 5, amount: 7 });

        act(() => result.current.history.undo());

        expect(result.current.editor.adjustments.vignette).toEqual({ size: 0, amount: 0 });
    });

    it('undoes on Cmd+Z and redoes on Cmd+Shift+Z', () => {
        const { result } = renderProbe();

        act(() => result.current.history.recordSnapshot());
        act(() => result.current.editor.setFilterIntensity(55));

        pressKey('z', { metaKey: true });

        expect(result.current.editor.filterIntensity).toBe(100);

        pressKey('z', { metaKey: true, shiftKey: true });

        expect(result.current.editor.filterIntensity).toBe(55);
    });

    it('redoes on Ctrl+Y', () => {
        const { result } = renderProbe();

        act(() => result.current.history.recordSnapshot());
        act(() => result.current.editor.setFilterIntensity(33));

        pressKey('z', { ctrlKey: true });
        pressKey('y', { ctrlKey: true });

        expect(result.current.editor.filterIntensity).toBe(33);
    });

    it('leaves the shortcut to the browser while a text field has focus', () => {
        const { result } = renderProbe();
        const input = document.createElement('input');

        document.body.appendChild(input);

        act(() => result.current.history.recordSnapshot());
        act(() => result.current.editor.setFilterIntensity(70));

        pressKey('z', { metaKey: true }, input);

        expect(result.current.editor.filterIntensity).toBe(70);

        input.remove();
    });

    it('leaves the redo shortcut to the browser while a textarea has focus', () => {
        const { result } = renderProbe();
        const textarea = document.createElement('textarea');

        document.body.appendChild(textarea);

        act(() => result.current.history.recordSnapshot());
        act(() => result.current.editor.setFilterIntensity(70));
        act(() => result.current.history.undo());

        expect(result.current.history.canRedo).toBe(true);

        pressKey('y', { ctrlKey: true }, textarea);

        expect(result.current.editor.filterIntensity).toBe(100);

        textarea.remove();
    });

    it('ignores an unmodified z keypress', () => {
        const { result } = renderProbe();

        act(() => result.current.history.recordSnapshot());
        act(() => result.current.editor.setFilterIntensity(45));

        pressKey('z');

        expect(result.current.editor.filterIntensity).toBe(45);
    });

    // The seam between the two halves of the cancelled-edit fix: IntensityControl decides when a
    // snapshot is worth recording, this hook decides when one is worth applying.
    describe('driving a real IntensityControl', () => {
        const renderSeam = () => {
            const Harness = () => {
                const { filterIntensity, setFilterIntensity } = useEditorContext();
                const { recordSnapshot } = useUndoRedoHistory();

                const seedEarlierChange = () => {
                    recordSnapshot();
                    setFilterIntensity(20);
                };

                return (
                    <>
                        <button type="button" onClick={seedEarlierChange}>
                            Seed
                        </button>
                        <IntensityControl
                            label="Intensity"
                            value={filterIntensity}
                            min={0}
                            max={100}
                            pattern="[0-9]*"
                            allowedPattern={/^\d*$/}
                            onChange={setFilterIntensity}
                            onEditStart={recordSnapshot}
                        />
                    </>
                );
            };

            return render(
                <EditorProvider>
                    <Harness />
                </EditorProvider>,
            );
        };

        it('undoes past a cancelled edit in one press', async () => {
            const user = userEvent.setup();

            renderSeam();

            await user.click(screen.getByRole('button', { name: 'Seed' }));

            expect(screen.getByLabelText('Intensity')).toHaveValue('20');

            await user.click(screen.getByRole('button', { name: 'Edit value' }));
            await user.clear(screen.getByLabelText('Intensity'));
            await user.type(screen.getByLabelText('Intensity'), '55{Escape}');

            expect(screen.getByLabelText('Intensity')).toHaveValue('20');

            await user.keyboard('{Meta>}z{/Meta}');

            expect(screen.getByLabelText('Intensity')).toHaveValue('100');
        });

        it('undoes past an edit that was opened and abandoned', async () => {
            const user = userEvent.setup();

            renderSeam();

            await user.click(screen.getByRole('button', { name: 'Seed' }));
            await user.click(screen.getByRole('button', { name: 'Edit value' }));

            // The control focuses the field in a rAF, so tabbing before that lands on it instead
            // of leaving it, and no blur ever fires.
            await waitFor(() => expect(screen.getByLabelText('Intensity')).toHaveFocus());

            await user.tab();

            expect(screen.getByLabelText('Intensity')).toHaveAttribute('readonly');

            await user.keyboard('{Meta>}z{/Meta}');

            expect(screen.getByLabelText('Intensity')).toHaveValue('100');
        });
    });

    it('stops listening once unmounted', () => {
        const { result, unmount } = renderProbe();

        act(() => result.current.history.recordSnapshot());
        act(() => result.current.editor.setFilterIntensity(60));

        const intensity = result.current.editor.filterIntensity;

        unmount();
        pressKey('z', { metaKey: true });

        expect(intensity).toBe(60);
    });
});
