import { format } from 'date-fns';

export function formatDateTime(date: Date | string | number | undefined): string {
    if (!date) return '—';

    const d = new Date(date);

    if (isNaN(d.getTime())) return String(date);

    return format(d, 'MMMM do yyyy, h:mm a');
}

export function formatDate(date: Date | string | number | undefined): string {
    if (!date) return '—';

    const d = new Date(date);

    if (isNaN(d.getTime())) return String(date);

    return format(d, 'MMMM do yyyy');
}

export function formatDateShort(date: Date | string | number | undefined): string {
    if (!date) return '—';

    const d = new Date(date);

    if (isNaN(d.getTime())) return String(date);

    return format(d, 'MMM dd, yyyy');
}

export function formatRelativeTime(date: Date | string | number, withSuffix = true): string {
    const d = new Date(date);

    if (isNaN(d.getTime())) return String(date);

    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.floor(Math.abs(diffMs) / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);

    let distance: string;

    if (diffSec < 45) distance = diffSec < 2 ? '1s' : `${diffSec}s`;
    else if (diffMin < 2) distance = '1min';
    else if (diffMin < 60) distance = `${diffMin} min`;
    else if (diffHour < 2) distance = `${diffHour} hour`;
    else if (diffHour < 24) distance = `${diffHour} hours`;
    else if (diffDay < 2) distance = `${diffDay} day`;
    else if (diffDay < 30) distance = `${diffDay} days`;
    else if (diffMonth < 2) distance = `${diffMonth} month`;
    else if (diffMonth < 12) distance = `${diffMonth} months`;
    else if (diffYear < 2) distance = `${diffYear} year`;
    else distance = `${diffYear} years`;

    return withSuffix ? `${distance} ago` : distance;
}
