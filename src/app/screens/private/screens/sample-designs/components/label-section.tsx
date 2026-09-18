import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Section } from './shared';

export default function LabelSection() {
    return (
        <Section title="Label" description="Form labels">
            <div className="max-w-md space-y-4">
                <div className="flex flex-col gap-2">
                    <Label htmlFor="label-demo-1">Label for input</Label>
                    <Input id="label-demo-1" placeholder="Associated input" />
                </div>
                <Label>Standalone label text</Label>
            </div>
        </Section>
    );
}
