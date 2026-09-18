import { useState } from 'react';

import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';

import { Section } from './shared';

export default function ConfirmationModalSection() {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    return (
        <Section title="Confirmation Modal" description="Reusable confirmation dialog">
            <div className="space-y-4">
                <Button variant="destructive" onClick={() => setIsConfirmOpen(true)}>
                    Open Confirmation Modal
                </Button>
                <ConfirmationModal
                    isOpen={isConfirmOpen}
                    onClose={() => setIsConfirmOpen(false)}
                    onConfirm={() => setIsConfirmOpen(false)}
                    title="Confirm Action"
                    message="Are you sure you want to proceed? This action cannot be undone."
                    confirmButtonText="Yes, proceed"
                    cancelButtonText="Cancel"
                />
            </div>
        </Section>
    );
}
