import { Badge } from '@/components/ui/badge';

import { Section } from './shared';

export default function BadgeSection() {
    return (
        <Section title="Badge" description="Badge variants">
            <div className="flex flex-wrap gap-2">
                <Badge variant="default">Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="ghost">Ghost</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="link">Link</Badge>
            </div>
        </Section>
    );
}
