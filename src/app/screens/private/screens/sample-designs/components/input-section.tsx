import { Input } from '@/components/ui/input';

import { Block, Section } from './shared';

export default function InputSection() {
    return (
        <Section title="Input" description="Input states">
            <div className="max-w-md space-y-4">
                <Block title="Default">
                    <Input placeholder="Placeholder text" />
                </Block>
                <Block title="With value">
                    <Input defaultValue="Filled value" />
                </Block>
                <Block title="Disabled">
                    <Input placeholder="Disabled" disabled />
                </Block>
                <Block title="Error state">
                    <Input placeholder="Error" isErrored />
                </Block>
            </div>
        </Section>
    );
}
