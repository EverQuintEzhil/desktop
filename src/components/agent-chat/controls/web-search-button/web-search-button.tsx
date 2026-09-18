import { GlobeIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { Props } from './web-search-button.props';
import './web-search-button.scss';

const WebSearchButton = (props: Props) => {
    const { isEnabled, onToggle } = props;

    if (!isEnabled) {
        return null;
    }

    return (
        <Button className="web-search-button h-8 rounded-full pr-3 pl-1" variant="outline" onClick={onToggle}>
            <div className="icon-wrapper flex h-6 w-6 items-center justify-center rounded-circle">
                <GlobeIcon className="globe-icon" />
                <XIcon className="xmark-icon" />
            </div>
            <span className="text-xs">Web Search</span>
        </Button>
    );
};

export default WebSearchButton;
