import { SlidersHorizontalIcon } from 'lucide-react';

import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

interface PublishToLauncherMenuItemProps {
    isBusy: boolean;
    onEdit: () => void;
}

/**
 * Publishing and the published state live on the top-bar button, and taking the launcher down has
 * its own row, so what is left here is the settings that do not belong in a header.
 *
 * Disabled while a visibility change is in flight. The visibility row keeps the menu open, so this
 * row sits one click away mid-request: the panel's refetch can beat the PUT, seeding the toggle
 * from the pre-change row and then diffing against it, which leaves the form claiming a state the
 * server has already moved off.
 */
const PublishToLauncherMenuItem = ({ isBusy, onEdit }: PublishToLauncherMenuItemProps) => (
    <DropdownMenuItem variant="default" className="cursor-pointer" disabled={isBusy} onSelect={() => onEdit()}>
        <SlidersHorizontalIcon aria-hidden="true" />
        Edit launcher…
    </DropdownMenuItem>
);

export default PublishToLauncherMenuItem;
