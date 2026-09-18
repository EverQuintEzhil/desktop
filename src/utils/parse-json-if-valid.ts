import type { Content } from 'vanilla-jsoneditor';

function parseJsonIfValid(content: Content) {
    try {
        if ('text' in content && content.text) {
            return JSON.parse(content.text);
        } else if ('json' in content && content.json) {
            return content.json;
        }
    } catch {
        return undefined;
    }
}

export default parseJsonIfValid;
