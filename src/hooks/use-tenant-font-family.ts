import { useEffect } from 'react';

const FONT_STYLE_ELEMENT_ID = 'style-font-family';

export const useTenantFontFamily = (fontFamily: string) => {
    useEffect(() => {
        const existingStyle = document.getElementById(FONT_STYLE_ELEMENT_ID);

        if (!fontFamily) {
            existingStyle?.remove();

            return;
        }

        const styleElement =
            existingStyle instanceof HTMLStyleElement ? existingStyle : document.createElement('style');

        styleElement.id = FONT_STYLE_ELEMENT_ID;
        styleElement.textContent = fontFamily;

        if (!styleElement.isConnected) {
            document.head.appendChild(styleElement);
        }

        return () => {
            document.getElementById(FONT_STYLE_ELEMENT_ID)?.remove();
        };
    }, [fontFamily]);
};
