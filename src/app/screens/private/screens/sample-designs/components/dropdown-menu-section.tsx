import { ChevronDownIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenuRoot,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

import { Section } from './shared';

export default function DropdownMenuSection() {
    return (
        <Section title="Dropdown Menu" description="Shadcn-style dropdown">
            <DropdownMenuRoot>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                        Open menu
                        <ChevronDownIcon className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => {}}>Profile</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {}}>Settings</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {}} variant="destructive">
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenuRoot>
        </Section>
    );
}
