import { useState } from 'react';

import MultiSelect from '@/components/multi-select';

import { Block, Section } from './shared';

export default function MultiSelectSection() {
    const [multiSelectValue, setMultiSelectValue] = useState<Array<{ label: string; value?: string }>>([]);
    const [multiSelectValue2, setMultiSelectValue2] = useState<Array<{ label: string; value?: string }>>([]);

    return (
        <Section title="Multi Select" description="Select multiple options">
            <div className="max-w-sm space-y-6">
                <Block title="Default">
                    <MultiSelect
                        data={[
                            { label: 'JavaScript', value: 'js' },
                            { label: 'TypeScript', value: 'ts' },
                            { label: 'Python', value: 'py' },
                            { label: 'Go', value: 'go' },
                            { label: 'Rust', value: 'rs' },
                        ]}
                        value={multiSelectValue}
                        onSelect={(items) => setMultiSelectValue(items)}
                        defaultText="Choose languages..."
                    />
                </Block>
                <Block title="With search">
                    <MultiSelect
                        data={[
                            { label: 'Red', value: 'red' },
                            { label: 'Green', value: 'green' },
                            { label: 'Blue', value: 'blue' },
                            { label: 'Yellow', value: 'yellow' },
                            { label: 'Purple', value: 'purple' },
                            { label: 'Orange', value: 'orange' },
                            { label: 'Pink', value: 'pink' },
                            { label: 'Brown', value: 'brown' },
                            { label: 'Gray', value: 'gray' },
                            { label: 'Black', value: 'black' },
                            { label: 'White', value: 'white' },
                        ]}
                        value={multiSelectValue2}
                        onSelect={(items) => setMultiSelectValue2(items)}
                        defaultText="Pick colors..."
                        allowSearch
                    />
                </Block>
            </div>
        </Section>
    );
}
