import { XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
    DialogHeader,
    DialogBody,
    DialogFooter,
    DialogDescription,
    DialogClose,
} from '@/components/ui/dialog';

import { Section } from './shared';

export default function DialogSection() {
    return (
        <Section title="Dialog" description="Modal dialog">
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline">Open Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader className="flex-row items-center justify-between">
                        <DialogTitle>Dialog title</DialogTitle>
                        <DialogClose asChild>
                            <Button type="button" variant="ghost" size="icon-sm" aria-label="Close Dialog">
                                <XIcon />
                            </Button>
                        </DialogClose>
                    </DialogHeader>
                    <DialogBody>
                        <DialogDescription>
                            This is the dialog description providing more context about the dialog.
                        </DialogDescription>
                    </DialogBody>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button>Confirm</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Section>
    );
}
