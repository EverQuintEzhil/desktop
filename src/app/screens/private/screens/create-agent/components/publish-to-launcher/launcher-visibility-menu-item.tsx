import { EyeIcon, EyeOffIcon, LoaderCircleIcon } from 'lucide-react';

import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

interface LauncherVisibilityMenuItemProps {
    isPublished: boolean;
    isPending: boolean;
    onToggle: () => void;
}

/**
 * Unpublishing needs its own row rather than only the toggle inside Edit launcher. The panel's
 * visible affordance for taking an agent down reads as `Delete launcher`, which people avoid
 * because it sounds like it destroys the launcher's settings and inherited user list — so a launch
 * ends up feeling one-way. This row is the reverse of the top-bar publish button, in the same
 * weight: one click out, one click back, nothing lost either way.
 */
const LauncherVisibilityMenuItem = ({ isPublished, isPending, onToggle }: LauncherVisibilityMenuItemProps) => {
    const renderIcon = () => {
        if (isPending) return <LoaderCircleIcon className="animate-spin" aria-hidden="true" />;

        return isPublished ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />;
    };

    return (
        <DropdownMenuItem
            variant="default"
            className="cursor-pointer"
            disabled={isPending}
            // Kept open so the row can swap to its opposite under the cursor and show that the
            // change landed. A menu that vanishes leaves the top-bar pill as the only feedback.
            onSelect={(event) => {
                event.preventDefault();
                onToggle();
            }}
        >
            {renderIcon()}
            {isPublished ? 'Unpublish launcher' : 'Publish launcher'}
        </DropdownMenuItem>
    );
};

export default LauncherVisibilityMenuItem;
