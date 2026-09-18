import { RestrictToVerticalAxis } from '@dnd-kit/abstract/modifiers';
import { RestrictToElement } from '@dnd-kit/dom/modifiers';

/**
 * `@dnd-kit/react` has no `@dnd-kit/modifiers` counterpart: the axis constraint lives in
 * `@dnd-kit/abstract/modifiers`, and `restrictToParentElement` became `RestrictToElement`, which
 * resolves its bounding element per drag instead of inferring it from the source node.
 */
export const VERTICAL_LIST_MODIFIERS = [
    RestrictToVerticalAxis,
    RestrictToElement.configure({
        element: (operation) => operation.source?.element?.parentElement ?? null,
    }),
];
