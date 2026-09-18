import { useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';

import { Section } from './shared';

export default function CheckboxSection() {
    const [checkboxChecked, setCheckboxChecked] = useState(false);

    return (
        <Section title="Checkbox" description="Checkbox states">
            <div className="flex flex-col gap-4">
                <Checkbox
                    value="opt1"
                    checked={checkboxChecked}
                    onChange={(_val, checked) => setCheckboxChecked(checked)}
                    label="Controlled checkbox"
                />
                <Checkbox value="opt2" checked={false} onChange={() => {}} label="Unchecked" />
                <Checkbox value="opt3" checked={true} onChange={() => {}} label="Checked" />
                <Checkbox value="opt4" checked={false} onChange={() => {}} label="Disabled" disabled />
            </div>
        </Section>
    );
}
