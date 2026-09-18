import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { Section } from './shared';

export default function PopoverSection() {
    return (
        <Section title="Popover" description="Floating content panel">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline">Open Popover</Button>
                </PopoverTrigger>
                <PopoverContent>
                    <div className="space-y-2 p-4">
                        <h4 className="text-sm font-medium text-foreground">Popover heading</h4>
                        <p className="text-sm text-muted-foreground">
                            This is the popover body content. It can contain anything.
                        </p>
                    </div>
                </PopoverContent>
            </Popover>
        </Section>
    );
}
