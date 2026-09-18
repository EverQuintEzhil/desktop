import { useState } from 'react';

import Select from '@/components/ui/select';

import { Block, Section } from './shared';

export default function SelectSection() {
    const [selectValue, setSelectValue] = useState<string | null>(null);
    const [selectValue2, setSelectValue2] = useState<string | null>(null);
    const [selectValue3, setSelectValue3] = useState<string | null>(null);

    return (
        <Section title="Select" description="Combobox-style select">
            <div className="max-w-sm space-y-6">
                <Block title="Default">
                    <Select
                        options={[
                            { value: 'react', label: 'React' },
                            { value: 'vue', label: 'Vue' },
                            { value: 'angular', label: 'Angular' },
                            { value: 'svelte', label: 'Svelte' },
                        ]}
                        value={selectValue}
                        onChange={setSelectValue}
                        placeholder="Choose a framework..."
                    />
                </Block>
                <Block title="With search">
                    <Select
                        options={[
                            { value: 'react', label: 'React' },
                            { value: 'vue', label: 'Vue' },
                            { value: 'angular', label: 'Angular' },
                            { value: 'svelte', label: 'Svelte' },
                            { value: 'solid', label: 'Solid' },
                        ]}
                        value={selectValue2}
                        onChange={setSelectValue2}
                        placeholder="Search frameworks..."
                        allowDeselect
                        allowSearch
                    />
                </Block>
                <Block title="Outline variant">
                    <Select
                        options={[
                            { value: 'sm', label: 'Small' },
                            { value: 'md', label: 'Medium' },
                            { value: 'lg', label: 'Large' },
                        ]}
                        value={selectValue3}
                        onChange={setSelectValue3}
                        placeholder="Pick a size..."
                        variant="outline"
                    />
                </Block>
                <Block title="Ghost variant">
                    <Select
                        options={[
                            { value: 'sm', label: 'Small' },
                            { value: 'md', label: 'Medium' },
                            { value: 'lg', label: 'Large' },
                        ]}
                        value={selectValue3}
                        onChange={setSelectValue3}
                        placeholder="Pick a size..."
                        variant="ghost"
                    />
                </Block>
                <Block title="Disabled">
                    <Select
                        options={[{ value: 'a', label: 'Option A' }]}
                        value={null}
                        onChange={() => {}}
                        placeholder="Disabled select"
                        disabled
                    />
                </Block>
            </div>
        </Section>
    );
}
