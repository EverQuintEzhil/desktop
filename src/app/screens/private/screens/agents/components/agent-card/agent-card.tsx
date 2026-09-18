import { InfoIcon, PencilIcon, PinIcon, SquareArrowOutUpRightIcon } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { RelativeTimestamp } from '@/app/components';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';
import type { LauncherType } from '@/types/admin';
import { getSafeHttpUrl } from '@/utils/url';

import AgentDetails from '../agent-details';

import './agent-card.scss';

/** `unavailable` — the stored layout has not resolved, so no pin can be written at all. */
export type PinDisabledReason = 'limit' | 'unavailable';

const PIN_UNAVAILABLE_COPY = 'Pinning is unavailable right now. Reload the page and try again.';

const pinDisabledCopy = (reason: PinDisabledReason, pinLimit: number | undefined): string => {
    if (reason === 'unavailable') return PIN_UNAVAILABLE_COPY;

    if (pinLimit === undefined) return 'Pin limit reached. Unpin an agent to pin another.';

    return `You can pin up to ${pinLimit} agents. Unpin one to pin another.`;
};

interface Props {
    agent: LauncherType;
    editTo?: string;
    /** Owned tiles carry the caller's last-used stamp; a firmwide tile's stored dates belong to the admin listing. */
    isOwned?: boolean;
    isPinned?: boolean;
    onTogglePin?: () => void;
    pinDisabledReason?: PinDisabledReason;
    pinLimit?: number;
    /** Inert copy for a drag preview: no anchor to navigate to, and no interactive controls. */
    isPreview?: boolean;
}
const AgentCard = (props: Props) => {
    const {
        agent,
        editTo,
        isOwned = false,
        isPinned = false,
        onTogglePin,
        pinDisabledReason,
        pinLimit,
        isPreview = false,
    } = props;
    const navigate = useNavigate();
    const safeLauncherUrl = agent.type === 'link' ? getSafeHttpUrl(agent.urlOrSlug) : null;

    const handleEdit = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (editTo) navigate(editTo);
        },
        [editTo, navigate],
    );

    const handleTogglePin = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            onTogglePin?.();
        },
        [onTogglePin],
    );

    const [sidesheetState, setSidesheetState] = useState<{
        isOpen: boolean;
        selectedAgent: LauncherType | null;
    }>({
        isOpen: false,
        selectedAgent: null,
    });

    const handleOpenSidesheet = useCallback((agent: LauncherType, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setSidesheetState({
            isOpen: true,
            selectedAgent: agent,
        });
    }, []);

    const handleCloseSidesheet = useCallback(() => {
        setSidesheetState({
            isOpen: false,
            selectedAgent: null,
        });
    }, []);

    const renderDetails = () => {
        if (!sidesheetState.selectedAgent) return null;

        return (
            <AgentDetails
                isOpen={sidesheetState.isOpen}
                selectedAgent={sidesheetState.selectedAgent}
                showTimestamps={isOwned}
                onClose={handleCloseSidesheet}
            />
        );
    };

    const renderPinButton = () => {
        if (!onTogglePin) return null;

        const button = (
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={isPinned ? `Unpin ${agent.name}` : `Pin ${agent.name}`}
                aria-pressed={isPinned}
                disabled={pinDisabledReason !== undefined}
                className={cn('popup rounded-full', isPinned && 'is-pinned')}
                onClick={handleTogglePin}
            >
                <PinIcon className={cn('size-4', isPinned && 'fill-current')} />
            </Button>
        );

        if (pinDisabledReason === undefined) return button;

        return (
            <SimpleTooltip content={pinDisabledCopy(pinDisabledReason, pinLimit)}>
                {/* Radix needs an enabled trigger: a disabled button emits no pointer events. */}
                <span className="inline-flex">{button}</span>
            </SimpleTooltip>
        );
    };

    const renderEditButton = () => {
        if (!editTo) return null;

        return (
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${agent.name}`}
                className="popup rounded-full"
                onClick={handleEdit}
            >
                <PencilIcon className="size-4" />
            </Button>
        );
    };

    const renderActions = () => {
        if (isPreview) return null;

        return (
            <div className="agent-card-actions absolute top-1 right-1 flex items-center gap-1">
                {agent.type === 'link' && <SquareArrowOutUpRightIcon className="link-icon size-4" />}
                {renderEditButton()}
                {renderPinButton()}
            </div>
        );
    };

    const renderTimestamp = () => {
        if (!isOwned) return null;

        const className = 'absolute right-10 bottom-1 flex h-8 items-center font-normal';

        if (agent.lastInteractedAt) {
            return (
                <RelativeTimestamp
                    label="Last used"
                    date={agent.lastInteractedAt}
                    showLabel={false}
                    className={className}
                />
            );
        }

        return (
            <RelativeTimestamp
                label="Created"
                date={agent.createdAt}
                emptyText="Not used yet"
                showLabel={false}
                className={className}
            />
        );
    };

    const renderDetailsButton = () => {
        if (isPreview) return null;

        return (
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`View ${agent.name} details`}
                className="popup absolute right-1 bottom-1 z-1 rounded-full"
                onClick={(e) => handleOpenSidesheet(agent, e)}
            >
                <InfoIcon className="size-4" />
            </Button>
        );
    };

    const cardContent = (
        <div
            role="presentation"
            className="agent-card relative flex h-full w-full cursor-pointer flex-col rounded-3xl bg-(--secondary) px-6 pt-8 pb-10"
        >
            {renderActions()}
            <h4 className="line-clamp-2 text-2xl font-semibold">{agent.name}</h4>
            <span className="agent-disc my-8 line-clamp-7 text-xs font-medium text-text-secondary">
                {agent.description}
            </span>
            {renderTimestamp()}
            {renderDetailsButton()}
        </div>
    );

    const renderCard = () => {
        if (isPreview) {
            return <div className="block h-full no-underline">{cardContent}</div>;
        }

        if (agent.type === 'link') {
            if (!safeLauncherUrl) {
                return <div className="block h-full no-underline">{cardContent}</div>;
            }

            return (
                <a
                    href={safeLauncherUrl}
                    className="block h-full rounded-3xl no-underline outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {cardContent}
                </a>
            );
        }

        return (
            <Link
                to={`/agent/${agent.urlOrSlug}`}
                className="block h-full rounded-3xl no-underline outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
                {cardContent}
            </Link>
        );
    };

    return (
        <>
            {renderCard()}
            {renderDetails()}
        </>
    );
};

export default AgentCard;
