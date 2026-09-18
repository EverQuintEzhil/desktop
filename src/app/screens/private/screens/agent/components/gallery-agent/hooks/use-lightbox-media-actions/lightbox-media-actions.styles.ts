const PILL_BG = 'rgb(255 255 255 / 6%)';
const W = 'var(--white)';

export function getBlackThemePopupStyle(): string {
    return `
        backdrop-filter: blur(22px);
        padding: 8px;
        border-radius: var(--radius-2xl);
        border: 0;
        background-color: rgba(37,37,37,.6);
        box-shadow: inset 0 0 0 0 #fff, inset 0 0 0 1px rgb(255 255 255 / .1), 0 6px 12px rgba(0,0,0,.2);
        ul li { i, span { color: ${W}; } &.selected, &:hover, &.selected-item { background-color: hsla(0,0%,100%,.1); } }
        .stepper-wrapper input, .stepper-wrapper button {
            background-color: ${PILL_BG}; border-color: ${PILL_BG}; color: ${W};
            span, i, .selected-value { color: ${W}; }
            &:hover, &:focus, &:active { background-color: ${PILL_BG}; border-color: ${PILL_BG}; color: ${W}; }
            &:disabled, &:disabled.btn-loading, &.disabled { color: hsla(0,0%,100%,.4); opacity: 0.65; }
        }
        .select .selected-wrapper .selected-value-block .selected-value, .selected-value { color: ${W}; }
    `;
}

/** Same selected-parameters pill style for both remix bar and edit overlay (dark theme) */
export function getParameterButtonStyles(): string {
    return `
        gap: 0; padding: 0 0 0 4px;
        background-color: ${PILL_BG}; border: 1px solid ${PILL_BG}; color: ${W};
        i, svg, .icon-wrapper i, .icon-wrapper svg, .selected-value-block i, .selected-value-block svg { color: ${W}; }
        .xmark-icon { display: none; }
        &:focus, &:active, &:focus:hover, &:active:hover {
            outline: none; background-color: ${PILL_BG}; border-color: ${PILL_BG};
        }
        &:focus-visible {
            outline: 1px solid white; outline-color: white;
            background-color: ${PILL_BG}; border-color: ${PILL_BG};
        }
        &:hover {
            background-color: ${PILL_BG}; border-color: ${PILL_BG};
            .selected-value-block i { color: ${W}; }
            .icon-wrapper {
                background-color: ${PILL_BG};
                i { color: ${W}; }
                .xmark-icon { display: flex; }
                .globe-icon { display: none; }
            }
        }
        .selected-value-block {
            border: 0; background-color: transparent; min-width: initial; height: auto;
            padding: 0 6px 0 4px;
            .selected-value { color: ${W}; }
            &:active, &:focus-visible, &:focus, &:hover {
                border: 0; background-color: transparent;
                .selected-value { color: ${W}; }
            }
        }
        .flex-center { color: ${W}; }
        @media only screen and (max-width: 1023px) { background-color: ${PILL_BG}; border: 1px solid ${PILL_BG}; }
    `;
}
