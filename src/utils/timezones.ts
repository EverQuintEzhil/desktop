import type { ComboboxOption } from '@/components/ui/select';

export const getTimezoneOffset = (timezone: string): string => {
    try {
        const date = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            timeZoneName: 'shortOffset',
        });
        const parts = formatter.formatToParts(date);
        const offsetPart = parts.find((part) => part.type === 'timeZoneName');

        return offsetPart ? offsetPart.value.replace('GMT', '') || '+00:00' : '';
    } catch {
        return '';
    }
};

const formatTimezoneLabel = (timezone: string): string => `${timezone} (UTC${getTimezoneOffset(timezone)})`;

export const TIMEZONE_OPTIONS: ComboboxOption<string>[] = Intl.supportedValuesOf('timeZone').map((timezone) => ({
    value: timezone,
    label: formatTimezoneLabel(timezone),
}));
