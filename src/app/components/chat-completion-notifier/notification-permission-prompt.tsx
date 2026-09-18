import { BellIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useAwayDuringRun } from '@/app/hooks/use-away-during-run';
import { Button } from '@/components/ui/button';
import { useNotificationPermission } from '@/hooks/use-notification-permission';
import { useNotificationPreference } from '@/hooks/use-notification-preference';
import type { ChatAgentType } from '@/types/admin';

interface Props {
    agent: ChatAgentType;
}

const PROMPT_GUIDANCE = 'Allow notifications in your browser prompt. If you do not see it, check the address bar.';
const BLOCKED_GUIDANCE = 'Notifications are blocked for this site. Re-enable them in your browser site settings.';

const NotificationPermissionPrompt = ({ agent }: Props) => {
    const { permission, canPrompt, request, dismiss } = useNotificationPermission();
    const { enabled, isLoaded } = useNotificationPreference();
    const wasAwayDuringRun = useAwayDuringRun();
    const [hasRequested, setHasRequested] = useState(false);
    const [isHidden, setIsHidden] = useState(false);
    const previousPermissionRef = useRef(permission);

    // Chromium's quiet omnibox chip grants without requestPermission() settling, so confirm off the permission transition, not the awaited result
    useEffect(() => {
        const previousPermission = previousPermissionRef.current;

        previousPermissionRef.current = permission;

        if (!hasRequested || permission !== 'granted' || previousPermission === 'granted') {
            return;
        }

        setHasRequested(false);
        toast.success('Notifications enabled.');
    }, [permission, hasRequested]);

    // Chromium's quiet omnibox chip leaves requestPermission() pending forever, so show guidance before the await, not after
    const handleEnable = (): void => {
        setHasRequested(true);

        void request();
    };

    const isBlocked = permission === 'denied';

    const handleDismiss = (): void => {
        setIsHidden(true);

        if (!isBlocked) {
            dismiss();
        }
    };

    const isInvited = canPrompt && wasAwayDuringRun;
    const isVisible = !isHidden && isLoaded && enabled && (isInvited || (hasRequested && isBlocked));

    if (!isVisible) return null;

    const renderMessageText = () => {
        if (isBlocked) return BLOCKED_GUIDANCE;

        if (hasRequested) return PROMPT_GUIDANCE;

        return <>Want to be notified when {agent.name} responds?</>;
    };

    const renderEnableButton = () => {
        if (isBlocked) return null;

        return (
            <Button size="sm" className="rounded-full px-4" onClick={handleEnable}>
                Enable
            </Button>
        );
    };

    return (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
            <BellIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {/* role=status must be mounted before its text changes, or SRs skip the announcement */}
            <p className="flex-1 text-sm text-muted-foreground" role="status" aria-live="polite">
                {renderMessageText()}
            </p>
            {renderEnableButton()}
            <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                onClick={handleDismiss}
                aria-label="Dismiss notification prompt"
            >
                <XIcon />
            </Button>
        </div>
    );
};

export default NotificationPermissionPrompt;
