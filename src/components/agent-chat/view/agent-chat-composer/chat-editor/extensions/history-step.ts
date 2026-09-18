import type { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';

export const asOwnUndoStep = (editor: Editor, mutate: () => boolean): boolean => {
    const { view } = editor;

    view.dispatch(closeHistory(view.state.tr));

    const changed = mutate();

    view.dispatch(closeHistory(view.state.tr));

    return changed;
};
