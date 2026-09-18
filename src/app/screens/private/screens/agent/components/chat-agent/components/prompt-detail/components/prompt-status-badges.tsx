import { GlobeIcon, LockIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

export interface Props {
    isPublished: boolean;
    isPrivate: boolean;
}

const PromptStatusBadges = (props: Props) => {
    const { isPublished, isPrivate } = props;

    return (
        <>
            {isPublished ? (
                <Badge variant="outline" className="rounded-full">
                    <GlobeIcon className="size-3" />
                    Published
                </Badge>
            ) : (
                <Badge variant="secondary" className="rounded-full">
                    Draft
                </Badge>
            )}
            {isPrivate ? (
                <Badge variant="outline" className="rounded-full">
                    <LockIcon className="size-3" />
                    Private
                </Badge>
            ) : null}
        </>
    );
};

export default PromptStatusBadges;
