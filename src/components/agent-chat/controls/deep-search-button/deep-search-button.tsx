import { TelescopeIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { Props } from './deep-search-button.props';
import './deep-search-button.scss';

/**
 * The Deep Research chip, in Web Search's shape: it exists only while the mode is on, and
 * clicking it turns the mode off. Turning it *on* is the plus dropdown's job, so the composer
 * toolbar only ever shows modes that are actually active.
 */
const DeepSearchButton = (props: Props) => {
    const { isEnabled, onToggle } = props;

    if (!isEnabled) {
        return null;
    }

    return (
        <Button
            className="deep-search-button h-8 rounded-full pr-3 pl-1"
            variant="outline"
            aria-label="Turn off Deep Research"
            onClick={onToggle}
        >
            <div className="icon-wrapper flex h-6 w-6 items-center justify-center rounded-circle">
                <TelescopeIcon className="telescope-icon" />
                <XIcon className="xmark-icon" />
            </div>
            <span className="text-xs">Deep Research</span>
        </Button>
    );
};

export default DeepSearchButton;
