import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { useNotificationPermission } from '@/hooks/use-notification-permission';
import { useNotificationPreference } from '@/hooks/use-notification-preference';

const TOGGLE_LABEL = 'Response completions';
const TOGGLE_DESCRIPTION = 'Get notified when a response finishes. Useful for long-running tasks.';

const UNSUPPORTED_GUIDANCE = 'This browser does not support notifications, so nothing can be delivered here.';
const BLOCKED_GUIDANCE =
    'Notifications are blocked for this site. They can only be turned back on from your browser settings.';
const PROMPT_GUIDANCE = 'Allow notifications in your browser prompt. If you do not see it, check the address bar.';
const UNGRANTED_GUIDANCE = 'Your browser has not allowed notifications yet, so nothing will be delivered.';

const NotificationsPanel = () => {
    const { enabled, isLoaded, setEnabled } = useNotificationPreference();
    const { permission, request } = useNotificationPermission();
    const [hasRequested, setHasRequested] = useState(false);

    useEffect(() => {
        if (permission !== 'default') {
            setHasRequested(false);
        }
    }, [permission]);

    const requestPermission = (): void => {
        setHasRequested(true);

        void request();
    };

    const handleToggle = (next: boolean): void => {
        setEnabled(next);

        if (!next) {
            setHasRequested(false);

            return;
        }

        if (permission === 'default') {
            requestPermission();
        }
    };

    const renderNotice = (message: string, action?: ReactNode) => (
        <div className="notifications-panel-notice flex items-center justify-between gap-4 border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">{message}</p>
            {action}
        </div>
    );

    const renderPermissionNotice = () => {
        if (!enabled) {
            return null;
        }

        if (permission === 'unsupported') {
            return renderNotice(UNSUPPORTED_GUIDANCE);
        }

        if (permission === 'denied') {
            return renderNotice(BLOCKED_GUIDANCE);
        }

        if (permission !== 'default') {
            return null;
        }

        if (hasRequested) {
            return renderNotice(PROMPT_GUIDANCE);
        }

        return renderNotice(
            UNGRANTED_GUIDANCE,
            <Button type="button" size="sm" onClick={requestPermission}>
                Allow notifications
            </Button>,
        );
    };

    return (
        <div className="notifications-panel mx-auto flex w-full max-w-4xl flex-col gap-6">
            <div className="notifications-panel-header flex flex-col gap-1">
                <h2 className="text-2xl font-semibold tracking-tight">Notifications</h2>
                <p className="text-sm text-muted-foreground">Choose when you are notified about activity.</p>
            </div>
            <div className="notifications-panel-card flex flex-col rounded-xl bg-card shadow-none">
                <div className="notifications-panel-row flex items-center justify-between gap-4 px-4 py-3">
                    <div className="notifications-panel-row-label flex flex-col gap-1">
                        <span className="text-sm font-medium">{TOGGLE_LABEL}</span>
                        <span className="text-sm text-muted-foreground">{TOGGLE_DESCRIPTION}</span>
                    </div>
                    <ToggleSwitch
                        checked={enabled}
                        onCheckedChange={handleToggle}
                        disabled={!isLoaded}
                        aria-label={TOGGLE_LABEL}
                    />
                </div>
                {/* role=status must be mounted before its content changes, or SRs skip the announcement */}
                <div role="status" aria-live="polite">
                    {renderPermissionNotice()}
                </div>
            </div>
        </div>
    );
};

export default NotificationsPanel;
