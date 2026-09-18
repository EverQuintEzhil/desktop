import { useState } from 'react';

import { RadioGroup } from '@/components/ui/radio-group';

import { Section } from './shared';

export default function RadioSection() {
    const [radioValue, setRadioValue] = useState('a');

    return (
        <Section title="Radio Group" description="Radio options">
            <div className="max-w-md">
                <RadioGroup
                    options={[
                        { name: 'g1', value: 'a', label: 'Option A' },
                        { name: 'g1', value: 'b', label: 'Option B' },
                        { name: 'g1', value: 'c', label: 'Option C' },
                    ]}
                    checked={radioValue}
                    onChange={setRadioValue}
                    orientation="vertical"
                />
            </div>
        </Section>
    );
}
