import { LockIcon, LockOpenIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import './public-mode-button.scss';

interface Props {
    isEnabled: boolean;
    isPublic: boolean;
    isDarkMode?: boolean;
    /** When false, the button shows the current state but the user cannot toggle it. */
    canToggle?: boolean;
    onToggle: () => void;
}

const PublicModeButton = (props: Props) => {
    const { isEnabled, isPublic, isDarkMode = false, canToggle = true, onToggle } = props;

    if (!isEnabled) {
        return null;
    }

    const handleToggle = () => {
        if (!canToggle) return;
        onToggle();
    };

    if (isPublic) {
        return (
            <Button
                size="sm"
                disabled={!canToggle}
                className={`public-mode-button public-button min-w-[86px] justify-start rounded-full ${isDarkMode ? 'active dark-mode text-white' : ''}`}
                onClick={handleToggle}
            >
                <LockOpenIcon className="size-4 text-white" />
                Public
            </Button>
        );
    }

    return (
        <Button
            variant={isDarkMode ? 'black' : 'outline'}
            size="sm"
            disabled={!canToggle}
            className={`public-mode-button private-button min-w-[86px] justify-start rounded-full ${isDarkMode ? 'dark-mode' : ''}`}
            onClick={handleToggle}
        >
            <LockIcon className="size-4" />
            Private
        </Button>
    );
};

export default PublicModeButton;
