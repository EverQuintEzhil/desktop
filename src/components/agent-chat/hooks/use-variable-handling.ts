import { useState } from 'react';

import { type TextAreaRef } from '@/components/text-area';
import { extractVariables, type VariableInfo } from '@/utils/variable-parser';

export interface UseVariableHandlingReturn {
    variables: VariableInfo[];
    activePopup: {
        variableName: string;
        position: { x: number; y: number };
    } | null;
    hasUnfilledVariables: boolean;
    handleVariablesChange: (detectedVariables: VariableInfo[]) => void;
    handleVariableClick: (variableName: string, position: { x: number; y: number }) => void;
    handleVariableValueChange: (
        variableName: string,
        value: string,
        query: string,
        setQuery: (query: string) => void,
        textAreaRef: { current: TextAreaRef | null },
    ) => void;
    handlePopupClose: () => void;
}

const useVariableHandling = (): UseVariableHandlingReturn => {
    const [variables, setVariables] = useState<VariableInfo[]>([]);
    const [activePopup, setActivePopup] = useState<{
        variableName: string;
        position: { x: number; y: number };
    } | null>(null);

    const handleVariablesChange = (detectedVariables: VariableInfo[]) => {
        setVariables(detectedVariables);
    };

    const handleVariableClick = (variableName: string, position: { x: number; y: number }) => {
        setActivePopup({ variableName, position });
    };

    const handleVariableValueChange = (
        variableName: string,
        value: string,
        query: string,
        setQuery: (query: string) => void,
        textAreaRef: { current: TextAreaRef | null },
    ) => {
        const variableRegex = new RegExp(
            `\\{\\{\\s*${variableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`,
            'g',
        );
        const match = variableRegex.exec(query);

        if (!match) return;

        const startPos = match.index;
        const updatedQuery = query.replace(variableRegex, value);

        textAreaRef.current?.changeText(updatedQuery);
        setQuery(updatedQuery);
        const newVariables = extractVariables(updatedQuery);

        setVariables(newVariables);

        setActivePopup(null);
        setTimeout(() => {
            const textAreaElement = textAreaRef.current?.element;

            if (textAreaElement && value.length > 0) {
                const range = document.createRange();
                const selection = window.getSelection();

                if (textAreaElement.firstChild) {
                    const textNode = textAreaElement.firstChild;
                    const newEndPos = startPos + value.length;

                    try {
                        range.setStart(textNode, startPos);
                        range.setEnd(textNode, newEndPos);
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                        textAreaElement.focus();
                    } catch {
                        textAreaElement.focus();
                    }
                }
            }
        }, 50);
    };

    const handlePopupClose = () => {
        setActivePopup(null);
    };

    const hasUnfilledVariables = variables.length > 0;

    return {
        variables,
        activePopup,
        hasUnfilledVariables,
        handleVariablesChange,
        handleVariableClick,
        handleVariableValueChange,
        handlePopupClose,
    };
};

export default useVariableHandling;
