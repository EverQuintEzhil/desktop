import { useState } from 'react';

import { Calendar } from '@/components/ui/calendar';

import { Section } from './shared';

export default function CalendarSection() {
    const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());

    return (
        <Section title="Calendar" description="Date picker calendar">
            <div className="max-w-sm">
                <Calendar
                    mode="single"
                    selected={calendarDate}
                    onSelect={setCalendarDate}
                    className="rounded-md border"
                />
                <p className="mt-2 text-sm text-muted-foreground">
                    Selected: {calendarDate?.toLocaleDateString() ?? 'none'}
                </p>
            </div>
        </Section>
    );
}
