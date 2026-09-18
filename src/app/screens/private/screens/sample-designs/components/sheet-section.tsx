import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';

import { Section } from './shared';

export default function SheetSection() {
    return (
        <Section title="Sheet" description="Slide-out panel">
            <div className="flex flex-wrap gap-4">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline">Open Right</Button>
                    </SheetTrigger>
                    <SheetContent side="right">
                        <SheetHeader>
                            <SheetTitle>Sheet title</SheetTitle>
                            <SheetDescription>A slide-out panel from the right.</SheetDescription>
                        </SheetHeader>
                        <SheetBody>Sheet body content goes here.</SheetBody>
                        <SheetFooter className="justify-end">
                            <Button size="sm">Save</Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline">Open Left</Button>
                    </SheetTrigger>
                    <SheetContent side="left">
                        <SheetTitle className="sr-only">Left sheet</SheetTitle>
                        <SheetDescription className="sr-only">
                            Slide-out panel from the left with additional content.
                        </SheetDescription>
                        <SheetHeader>
                            <SheetTitle>Left sheet</SheetTitle>
                        </SheetHeader>
                        <SheetBody>Content from the left side.</SheetBody>
                    </SheetContent>
                </Sheet>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline">Open Bottom</Button>
                    </SheetTrigger>
                    <SheetContent side="bottom">
                        <SheetTitle className="sr-only">Bottom sheet</SheetTitle>
                        <SheetDescription className="sr-only">Bottom sheet with additional content.</SheetDescription>
                        <SheetHeader>
                            <SheetTitle>Bottom sheet</SheetTitle>
                        </SheetHeader>
                        <SheetBody>Content from the bottom.</SheetBody>
                    </SheetContent>
                </Sheet>
            </div>
        </Section>
    );
}
