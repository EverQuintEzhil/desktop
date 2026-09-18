import { LayoutGridIcon, ListIcon } from 'lucide-react';
import { useState } from 'react';

import Switch from '@/components/ui/switch';

import { Block, Section } from './shared';

export default function SwitchSection() {
    const [switchIndex, setSwitchIndex] = useState(0);

    return (
        <Section title="Switch" description="Tabbed switch toggle">
            <div className="space-y-6">
                <Block title="Two options">
                    <Switch
                        options={[{ label: 'Monthly' }, { label: 'Yearly' }]}
                        activeIndex={switchIndex}
                        onChange={(_e, idx) => setSwitchIndex(idx)}
                    />
                </Block>
                <Block title="With icons">
                    <Switch
                        options={[
                            { label: 'List', icon: ListIcon },
                            { label: 'Grid', icon: LayoutGridIcon },
                        ]}
                        activeIndex={switchIndex}
                        onChange={(_e, idx) => setSwitchIndex(idx)}
                    />
                </Block>
                <Block title="Three options">
                    <Switch
                        options={[{ label: 'Day' }, { label: 'Week' }, { label: 'Month' }]}
                        activeIndex={switchIndex > 2 ? 0 : switchIndex}
                        onChange={(_e, idx) => setSwitchIndex(idx)}
                    />
                </Block>
            </div>
        </Section>
    );
}
