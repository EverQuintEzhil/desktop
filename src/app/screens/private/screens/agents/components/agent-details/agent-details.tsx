import { XIcon } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

import { RelativeTimestamp } from '@/app/components';
import { ExpandableText } from '@/components';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Tag from '@/components/ui/tag';
import { sanitizeRichText } from '@/lib/sanitize-html';
import type { LauncherType, AgentType } from '@/types/admin';
import { getSafeHttpUrl } from '@/utils/url';

import './agent-details.scss';

interface AgentDetailsProps {
    isOpen: boolean;
    selectedAgent: LauncherType | AgentType | null;
    isAgentType?: boolean;
    /** Owned agents only: a firmwide launcher's stored dates belong to the admin listing, not the agent. */
    showTimestamps?: boolean;
    onClose: () => void;
}

const AgentDetails: React.FC<AgentDetailsProps> = ({
    isOpen,
    selectedAgent,
    isAgentType = false,
    showTimestamps = false,
    onClose,
}) => {
    const safeLauncherUrl =
        !isAgentType && selectedAgent?.type === 'link' ? getSafeHttpUrl(selectedAgent.urlOrSlug) : null;

    const getDetailedDescription = (): string => {
        if (!selectedAgent) return '';

        if ('detailedDescription' in selectedAgent && typeof selectedAgent.detailedDescription === 'string') {
            return selectedAgent.detailedDescription;
        }

        if (
            'launcher' in selectedAgent &&
            selectedAgent.launcher &&
            typeof selectedAgent.launcher.detailedDescription === 'string'
        ) {
            return selectedAgent.launcher.detailedDescription;
        }

        return '';
    };

    const getDescription = (): string => {
        if (!selectedAgent) return '';

        if ('description' in selectedAgent && typeof selectedAgent.description === 'string') {
            return selectedAgent.description;
        }

        if (
            'launcher' in selectedAgent &&
            selectedAgent.launcher &&
            typeof selectedAgent.launcher.description === 'string'
        ) {
            return selectedAgent.launcher.description;
        }

        return '';
    };

    const getButtonTarget = (): string => {
        if (!selectedAgent || !('urlOrSlug' in selectedAgent)) return '_self';

        return selectedAgent.type === 'link' ? '_blank' : '_self';
    };

    const getButtonLink = (): string | null => {
        if (!selectedAgent || !('urlOrSlug' in selectedAgent)) return null;

        return selectedAgent.type === 'link' ? safeLauncherUrl : `/agent/${selectedAgent.urlOrSlug}`;
    };

    const description = getDescription();
    const detailedDescription = getDetailedDescription();
    const tags = selectedAgent?.tags ?? [];
    const hasTags = tags.length > 0;
    const showTagsOrOpenRow = hasTags || !isAgentType;
    const hasTimestamps = showTimestamps && Boolean(selectedAgent?.createdAt || selectedAgent?.updatedAt);
    const buttonLink = getButtonLink();
    const isExternalButton = getButtonTarget() === '_blank';

    const renderOpenAgentButton = () => {
        if (isExternalButton && buttonLink) {
            return (
                <Button
                    asChild
                    size="sm"
                    className="open-agent-button ml-auto h-auto min-h-[26px] rounded-sm text-sm font-normal"
                    onClick={onClose}
                >
                    <a href={buttonLink} target="_blank" rel="noopener noreferrer">
                        Open Agent
                    </a>
                </Button>
            );
        }

        if (buttonLink) {
            return (
                <Button
                    asChild
                    size="sm"
                    className="open-agent-button ml-auto h-auto min-h-[26px] rounded-sm text-sm font-normal"
                    onClick={onClose}
                >
                    <Link to={buttonLink}>Open Agent</Link>
                </Button>
            );
        }

        return (
            <Button
                size="sm"
                className="open-agent-button ml-auto h-auto min-h-[26px] rounded-sm text-sm font-normal"
                disabled
            >
                Open Agent
            </Button>
        );
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="agent-details-dialog p-0 lg:max-w-[780px]">
                <DialogHeader className="flex-row items-center justify-between gap-3">
                    <DialogTitle className="min-w-0 text-xl">{selectedAgent?.name || 'Info'}</DialogTitle>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Close agent details"
                        onClick={onClose}
                    >
                        <XIcon />
                    </Button>
                </DialogHeader>
                {selectedAgent && (
                    <DialogBody>
                        <div className="agent-details-dialog-body flex w-full flex-col gap-8">
                            {description && (
                                <div className="agent-details-dialog-body-description flex flex-col gap-3">
                                    <span className="text-sm">{description}</span>
                                </div>
                            )}
                            {showTagsOrOpenRow && (
                                <div className="agent-details-dialog-body-tags flex items-center justify-between gap-3">
                                    {hasTags && (
                                        <div className="flex flex-1 flex-wrap gap-2">
                                            {tags.map((tag, index) => (
                                                <Tag key={`${tag}-${index}`} size="small" variant="pill" label={tag} />
                                            ))}
                                        </div>
                                    )}
                                    {!isAgentType && renderOpenAgentButton()}
                                </div>
                            )}

                            {hasTimestamps && (
                                <div className="agent-details-dialog-body-timestamps flex flex-wrap items-center gap-4">
                                    <RelativeTimestamp label="Created" date={selectedAgent.createdAt} />
                                    <RelativeTimestamp label="Updated" date={selectedAgent.updatedAt} />
                                    <RelativeTimestamp
                                        label="Last used"
                                        date={selectedAgent.lastInteractedAt}
                                        emptyText="Not used yet"
                                    />
                                </div>
                            )}

                            {detailedDescription && (
                                <div className="agent-details-dialog-body-detailed-description flex w-full min-w-0 flex-col gap-3">
                                    <ExpandableText maxLines={8} buttonClassName="font-bold mt-1.5">
                                        <div
                                            dangerouslySetInnerHTML={{
                                                __html: sanitizeRichText(detailedDescription || ''),
                                            }}
                                            className="rich-text-content text-sm font-normal text-(--text-primary)"
                                        />
                                    </ExpandableText>
                                </div>
                            )}
                        </div>
                    </DialogBody>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default AgentDetails;
