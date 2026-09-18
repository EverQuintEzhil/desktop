import { useAui, useAuiState } from '@assistant-ui/react';
import { useCallback } from 'react';

export const useAuiComposerBinding = () => {
    const aui = useAui();
    const value = useAuiState((s) => s.composer.text);

    const onChange = useCallback(
        (text: string) => {
            aui.composer.setText(text);
        },
        [aui],
    );

    return { value, onChange };
};
