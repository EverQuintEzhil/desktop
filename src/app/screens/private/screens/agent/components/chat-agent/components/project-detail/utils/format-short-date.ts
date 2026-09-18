/** Formats a date as e.g. "Mar 4, 10:00 AM"; returns '' for a missing/invalid value. */
export const formatShortDate = (value: string | number): string => {
    if (!value) return '';
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};
