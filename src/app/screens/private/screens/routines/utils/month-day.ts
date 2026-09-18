export const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const encodeMonthDay = (month: number, monthDay: number): string => `${month}-${monthDay}`;

export const isValidMonthDay = (month: number, monthDay: number): boolean => {
    if (!Number.isInteger(month) || month < 1 || month > 12) return false;

    return Number.isInteger(monthDay) && monthDay >= 1 && monthDay <= DAYS_IN_MONTH[month - 1];
};

export const decodeMonthDay = (encoded: string): { month: number; monthDay: number } | null => {
    const match = /^(\d{1,2})-(\d{1,2})$/.exec(encoded);

    if (!match) return null;

    const month = Number(match[1]);
    const monthDay = Number(match[2]);

    return isValidMonthDay(month, monthDay) ? { month, monthDay } : null;
};

export const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

export const isValidYearMonthDay = (year: number, month: number, monthDay: number): boolean => {
    if (!Number.isInteger(year) || year < 1970 || year > 9999) return false;
    if (!isValidMonthDay(month, monthDay)) return false;

    return !(month === 2 && monthDay === 29 && !isLeapYear(year));
};

export const nextOccurrenceYear = (month: number, monthDay: number, now: Date = new Date()): number => {
    if (!isValidMonthDay(month, monthDay)) return now.getFullYear();

    const hasPassed = month < now.getMonth() + 1 || (month === now.getMonth() + 1 && monthDay < now.getDate());
    let year = now.getFullYear() + (hasPassed ? 1 : 0);

    while (!isValidYearMonthDay(year, month, monthDay)) year += 1;

    return year;
};
