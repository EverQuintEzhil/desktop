const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatHour = (h: string) => {
    const n = parseInt(h, 10);

    if (n === 0) return '12:00 AM';
    if (n === 12) return '12:00 PM';

    return n < 12 ? `${n}:00 AM` : `${n - 12}:00 PM`;
};

const formatMinute = (m: string) => {
    const n = parseInt(m, 10);

    return n < 10 ? `0${n}` : `${n}`;
};

export const cronToStatement = (cron: string): string => {
    const trimmed = cron.trim();

    if (!trimmed) return 'Not set';

    const parts = trimmed.split(/\s+/);

    if (parts.length < 5) return trimmed;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    const isWild = (s: string) => s === '*' || s === '?';
    const isStep = (s: string) => s.startsWith('*/');
    const isRange = (s: string) => /^\d+-\d+$/.test(s);
    const isList = (s: string) => /^\d+(,\d+)+$/.test(s);
    const isNum = (s: string) => /^\d+$/.test(s);

    const stepVal = (s: string) => (s.startsWith('*/') ? s.slice(2) : null);

    // Every minute
    if (isWild(minute) && isWild(hour) && isWild(dayOfMonth) && isWild(month) && isWild(dayOfWeek)) {
        return 'Every minute';
    }

    // Every N minutes
    const minStep = stepVal(minute);

    if (minStep && isWild(hour) && isWild(dayOfMonth) && isWild(month) && isWild(dayOfWeek)) {
        const n = parseInt(minStep, 10);

        return n === 1 ? 'Every minute' : `Every ${n} minutes`;
    }

    // Hourly (at minute 0 or specific minute)
    if (isWild(dayOfMonth) && isWild(month) && isWild(dayOfWeek)) {
        if (isWild(hour)) {
            if (isNum(minute)) {
                return parseInt(minute, 10) === 0 ? 'Every hour' : `Every hour at :${formatMinute(minute)}`;
            }

            return 'Every hour';
        }
        if (isNum(hour) && (isNum(minute) || isWild(minute))) {
            const m = isWild(minute) ? '00' : formatMinute(minute);

            return `Daily at ${formatHour(hour).replace(':00', `:${m}`)}`;
        }
    }

    // Daily at specific time
    if (isWild(dayOfMonth) && isWild(month) && isWild(dayOfWeek) && isNum(hour) && isNum(minute)) {
        const time = formatHour(hour).replace(':00', `:${formatMinute(minute)}`);

        return `Daily at ${time}`;
    }

    // Day of week
    if (isWild(dayOfMonth) && isWild(month) && !isWild(dayOfWeek)) {
        const timePart =
            isNum(hour) && isNum(minute) ? ` at ${formatHour(hour).replace(':00', `:${formatMinute(minute)}`)}` : '';

        if (isRange(dayOfWeek)) {
            if (dayOfWeek === '1-5') return `Weekdays${timePart}`;

            const [a, b] = dayOfWeek.split('-').map((d) => parseInt(d, 10));
            const names = DAY_NAMES.slice(a, b + 1).join(', ');

            return `${names}${timePart}`;
        }
        if (isList(dayOfWeek)) {
            if (dayOfWeek === '0,6') return `Weekends${timePart}`;

            const indices = dayOfWeek.split(',').map((d) => parseInt(d, 10));
            const names = indices.map((i) => DAY_NAMES[i]).join(', ');

            return `${names}${timePart}`;
        }
        if (isNum(dayOfWeek)) {
            return `${DAY_NAMES[parseInt(dayOfWeek, 10)]}${timePart}`;
        }
    }

    // Day of month (e.g. 1st of month)
    if (isNum(dayOfMonth) && isWild(month) && isWild(dayOfWeek)) {
        const ord = (n: number) => {
            if (n === 1 || n === 21 || n === 31) return `${n}st`;
            if (n === 2 || n === 22) return `${n}nd`;
            if (n === 3 || n === 23) return `${n}rd`;

            return `${n}th`;
        };
        const timePart =
            isNum(hour) && isNum(minute) ? ` at ${formatHour(hour).replace(':00', `:${formatMinute(minute)}`)}` : '';

        return `Monthly on the ${ord(parseInt(dayOfMonth, 10))}${timePart}`;
    }

    // Specific month(s)
    if (isNum(month) && isNum(dayOfMonth)) {
        const timePart =
            isNum(hour) && isNum(minute) ? ` at ${formatHour(hour).replace(':00', `:${formatMinute(minute)}`)}` : '';
        const m = parseInt(month, 10);

        return `${MONTH_NAMES[m - 1]} ${dayOfMonth}${timePart}`;
    }

    // Fallback: describe parts
    const desc: string[] = [];

    if (!isWild(minute)) desc.push(isStep(minute) ? `every ${stepVal(minute)} min` : `:${minute}`);
    if (!isWild(hour)) desc.push(isNum(hour) ? formatHour(hour) : hour);
    if (!isWild(dayOfMonth)) desc.push(`day ${dayOfMonth}`);
    if (!isWild(month)) desc.push(isNum(month) ? MONTH_NAMES[parseInt(month, 10) - 1] : month);
    if (!isWild(dayOfWeek)) desc.push(isNum(dayOfWeek) ? DAY_NAMES[parseInt(dayOfWeek, 10)] : dayOfWeek);

    return desc.length > 0 ? desc.join(' ') : 'Every minute';
};
