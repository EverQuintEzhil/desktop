/** Formats a date-like value as e.g. "Jan 5, 3:45 PM"; returns '' for empty/invalid input. */
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

export default formatShortDate;
