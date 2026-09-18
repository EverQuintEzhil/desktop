import { Spinner } from '@/components/ui/spinner';

import { Section } from './shared';

export default function SpinnerSection() {
    return (
        <Section title="Spinner" description="Loading indicator">
            <div className="flex items-center gap-6">
                <Spinner className="size-6" />
                <Spinner className="size-8 text-primary" />
                <Spinner className="size-10 text-muted-foreground" />
            </div>
        </Section>
    );
}
