/** "GMT+5:30" for an IANA id like "Asia/Calcutta"; falls back to the id when the runtime does not know the zone. */
export const timezoneLabel = (timezone: string, at: Date = new Date()): string => {
    try {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' })
            .formatToParts(at)
            .find((part) => part.type === 'timeZoneName');

        return parts?.value ?? timezone;
    } catch {
        return timezone;
    }
};

/**
 * The zone tag a schedule line carries, or null when the routine fires in the viewer's own zone —
 * zones compare by effective offset so aliases like Asia/Calcutta and Asia/Kolkata read as one.
 */
export const timezoneSuffixForViewer = (timezone: string | null | undefined, at: Date = new Date()): string | null => {
    if (!timezone) return null;

    const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (timezone === viewerZone) return null;

    const label = timezoneLabel(timezone, at);

    if (label === timezoneLabel(viewerZone, at)) return null;

    return label;
};
