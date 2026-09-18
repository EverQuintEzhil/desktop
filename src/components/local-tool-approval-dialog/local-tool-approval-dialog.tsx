import { useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { getCurrentPrompt, resolveCurrentPrompt, subscribeToPrompt } from '@/lib/local-tools/approval';

/**
 * Global singleton (mounted once in app.tsx): approves or denies a local
 * coding tool's permission grant. Prompts queue FIFO in the store; closing the
 * dialog counts as Deny, and an unanswered prompt auto-denies after 2 minutes.
 */
const LocalToolApprovalDialog = () => {
    const prompt = useSyncExternalStore(subscribeToPrompt, getCurrentPrompt);

    if (!prompt) {
        return null;
    }

    const { toolName, grant } = prompt;

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    resolveCurrentPrompt('deny');
                }
            }}
        >
            <DialogContent className="max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>Allow local access?</DialogTitle>
                </DialogHeader>
                <DialogBody className="flex flex-col gap-3 py-4">
                    <p className="text-sm">
                        The <span className="font-medium">{toolName}</span> tool wants {grant.mode} access to:
                    </p>
                    <code className="block overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-sm">
                        {grant.target}
                    </code>
                    {grant.why ? <p className="text-xs text-muted-foreground">{grant.why}</p> : null}
                    <p className="text-xs text-muted-foreground">
                        This runs on your computer inside the space's workspace folder. Deny it if you did not
                        expect it. "Always allow" remembers this exact command for future chats.
                    </p>
                </DialogBody>
                <DialogFooter className="justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => resolveCurrentPrompt('deny')}>
                        Deny
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => resolveCurrentPrompt('allow-always')}>
                        Always allow
                    </Button>
                    <Button size="sm" onClick={() => resolveCurrentPrompt('allow-once')}>
                        Allow once
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default LocalToolApprovalDialog;
