import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogBody,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

import { Section } from './shared';

export default function AlertDialogSection() {
    return (
        <Section title="Alert Dialog" description="Confirmation dialog">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive">Delete item</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogBody>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                        <p className="text-sm">
                            Do you really want to delete this item? This process cannot be undone.
                        </p>
                    </AlertDialogBody>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Section>
    );
}
