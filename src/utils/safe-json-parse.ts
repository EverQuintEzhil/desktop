function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
    if (json === null || json === undefined) {
        return fallback;
    }

    try {
        return JSON.parse(json) as T;
    } catch {
        return fallback;
    }
}

export default safeJsonParse;
