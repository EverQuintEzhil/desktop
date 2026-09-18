import { CheckIcon, HeartIcon, PlusIcon, SettingsIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { Block, Section } from './shared';

export default function ButtonSection() {
    return (
        <Section title="Button" description="Variants and sizes">
            <div className="space-y-6">
                <Block title="Variants">
                    <div className="flex flex-wrap gap-2">
                        <Button variant="default">Default</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="destructive">Destructive</Button>
                        <Button variant="link">Link</Button>
                        <Button variant="black">Black</Button>
                    </div>
                </Block>
                <Block title="Sizes">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button size="xs">Extra small</Button>
                        <Button size="sm">Small</Button>
                        <Button size="default">Default</Button>
                        <Button size="lg">Large</Button>
                        <Button size="icon-xs">
                            <CheckIcon />
                        </Button>
                        <Button size="icon-sm">
                            <SettingsIcon />
                        </Button>
                        <Button size="icon">
                            <PlusIcon />
                        </Button>
                        <Button size="icon-lg">
                            <HeartIcon />
                        </Button>
                    </div>
                </Block>
                <Block title="Disabled">
                    <div className="flex flex-wrap gap-2">
                        <Button variant="default" disabled>
                            Default
                        </Button>
                        <Button variant="outline" disabled>
                            Outline
                        </Button>
                    </div>
                </Block>
            </div>
        </Section>
    );
}
