const ESCAPE_CANCELS_EDIT_ATTRIBUTE = 'data-escape-cancels-edit';

// Radix's DismissableLayer listens for Escape in the capture phase on `document`, so a field
// that treats Escape as "cancel this edit" cannot stop the event before the layer sees it.
// The field marks itself with this attribute instead, and the dialog defers to it. The
// attribute must only be in the DOM while the field is actually mid-edit.
export const ESCAPE_CANCELS_EDIT_PROPS = { [ESCAPE_CANCELS_EDIT_ATTRIBUTE]: '' } as const;

// For fields React does not own the element of — a ProseMirror contenteditable, for instance —
// the same mark has to be applied imperatively.
export const markEscapeCancelsEdit = (element: HTMLElement | null | undefined): void => {
    element?.setAttribute(ESCAPE_CANCELS_EDIT_ATTRIBUTE, '');
};

export const unmarkEscapeCancelsEdit = (element: HTMLElement | null | undefined): void => {
    element?.removeAttribute(ESCAPE_CANCELS_EDIT_ATTRIBUTE);
};

const isEscapeConsumedByFieldEdit = (event: KeyboardEvent): boolean => {
    const target = event.target as HTMLElement | null;

    return Boolean(target?.closest(`[${ESCAPE_CANCELS_EDIT_ATTRIBUTE}]`));
};

// A held Escape auto-repeats: the first press cancels a field edit and blurs it, so the
// repeats land on the body and would dismiss the whole dialog the edit belongs to.
export const shouldEscapeKeepDialogOpen = (event: KeyboardEvent): boolean => {
    return event.repeat || isEscapeConsumedByFieldEdit(event);
};
