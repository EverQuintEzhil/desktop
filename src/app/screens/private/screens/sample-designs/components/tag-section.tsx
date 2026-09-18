import { Tag } from '@/components/ui/tag';

import { Block, Section } from './shared';

export default function TagSection() {
    return (
        <Section title="Tag" description="Tag variants and sizes">
            <div className="space-y-4">
                <Block title="Rounded, unselected">
                    <div className="flex flex-wrap items-center gap-2">
                        <Tag label="Small" size="small" />
                        <Tag label="Regular" size="regular" />
                        <Tag label="Large" size="large" />
                    </div>
                </Block>
                <Block title="Selected">
                    <div className="flex flex-wrap gap-2">
                        <Tag label="Selected" selected />
                    </div>
                </Block>
                <Block title="Variants">
                    <div className="flex flex-wrap gap-2">
                        <Tag label="Rounded" variant="rounded" />
                        <Tag label="Pill" variant="pill" />
                        <Tag label="Circle" variant="roundedCircle" />
                    </div>
                </Block>
            </div>
        </Section>
    );
}
