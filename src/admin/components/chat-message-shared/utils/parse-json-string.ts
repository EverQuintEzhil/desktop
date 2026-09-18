export function parseJsonString(value: string): unknown | null {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}
