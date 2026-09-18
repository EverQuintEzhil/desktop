import { Progress } from '@/components/ui/progress';

import { Block, Section } from './shared';

export default function ProgressSection() {
    return (
        <Section title="Progress" description="Progress bar (0–100)">
            <div className="max-w-md space-y-4">
                <Block title="0%">
                    <Progress value={0} />
                </Block>
                <Block title="33%">
                    <Progress value={33} />
                </Block>
                <Block title="66%">
                    <Progress value={66} />
                </Block>
                <Block title="100%">
                    <Progress value={100} />
                </Block>
            </div>
        </Section>
    );
}
