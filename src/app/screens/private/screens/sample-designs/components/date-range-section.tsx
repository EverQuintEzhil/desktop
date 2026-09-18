import { useState } from 'react';

import DateRangeFilter, { DateRangePickerMerged } from '@/components/ui/date-range-filter';

import { Block, Section } from './shared';

export default function DateRangeSection() {
    const [dateRange, setDateRange] = useState({ from: '', to: '' });

    return (
        <Section title="Date Range" description="Date range picker">
            <div className="space-y-6">
                <Block title="Separate pickers">
                    <DateRangeFilter
                        label="Date Range"
                        value={dateRange}
                        onDateChange={(key, value) => setDateRange((prev) => ({ ...prev, [key]: value }))}
                    />
                </Block>
                <Block title="Merged range picker">
                    <DateRangePickerMerged label="Select period" value={dateRange} onRangeChange={setDateRange} />
                </Block>
            </div>
        </Section>
    );
}
