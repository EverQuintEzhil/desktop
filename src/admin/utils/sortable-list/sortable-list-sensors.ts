import { KeyboardSensor, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';

const DRAG_ACTIVATION_DISTANCE = 4;
const TOUCH_ACTIVATION_DELAY_MS = 250;

/**
 * `PointerSensor.defaults.activationConstraints` returns `undefined` for a mouse press that lands
 * inside the draggable's own handle, and `ActivationController.onEvent` activates synchronously when
 * there are no constraints — so a plain click on the grip runs a whole drag. With no `DragOverlay`
 * here the row itself is the feedback element, so that click puts `position: fixed` on it. Touch
 * keeps the library's own long-press default so a scroll that starts on the grip stays a scroll.
 *
 * Passing `sensors` replaces the default preset rather than extending it, so `KeyboardSensor` has to
 * be listed to keep keyboard dragging.
 */
export const SORTABLE_LIST_SENSORS = [
    PointerSensor.configure({
        activationConstraints: (event) => {
            if (event.pointerType === 'touch') {
                return [new PointerActivationConstraints.Delay({ value: TOUCH_ACTIVATION_DELAY_MS, tolerance: 5 })];
            }

            return [new PointerActivationConstraints.Distance({ value: DRAG_ACTIVATION_DISTANCE })];
        },
    }),
    KeyboardSensor,
];
