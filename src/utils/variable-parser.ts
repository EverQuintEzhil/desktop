export interface VariableInfo {
    name: string;
    startIndex: number;
    endIndex: number;
    fullMatch: string;
}

export const extractVariables = (text: string): VariableInfo[] => {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables: VariableInfo[] = [];
    let match;

    while ((match = variableRegex.exec(text)) !== null) {
        variables.push({
            name: match[1].trim(),
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            fullMatch: match[0],
        });
    }

    return variables;
};
