import { RocketIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

import type { AgentLauncher } from '../../lib/launcher-publish';

interface PublishToLauncherButtonProps {
    agentId: string;
    launcher: AgentLauncher | null;
    onPublish: () => void;
}

/**
 * Sits beside `Try it out` rather than in the overflow menu: an agent with no launcher reaches
 * nobody, and a builder who has to already know Launchers exist gets no signal that a step is
 * missing. Published, the button stops being an action and becomes the state, named.
 */
const PublishToLauncherButton = ({ agentId, launcher, onPublish }: PublishToLauncherButtonProps) => {
    if (!launcher) {
        return (
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full px-[14px]"
                aria-label="Publish to launcher"
                onClick={onPublish}
            >
                <RocketIcon aria-hidden="true" />
                <span className="hidden sm:inline">Publish to launcher</span>
            </Button>
        );
    }

    const isPublished = launcher.isPublished !== false;

    return (
        <Button
            asChild
            type="button"
            variant="outline"
            size="sm"
            className="publish-to-launcher-state max-w-[220px] rounded-full px-[14px]"
        >
            {/* By agent id, not the launcher slug: renaming the agent rewrites its slug and the
                launcher URL drifts, but the id always resolves. */}
            <Link
                to={`/agent/${agentId}`}
                aria-label={
                    isPublished
                        ? `Open the ${launcher.name} launcher, live on the home screen`
                        : `Open the ${launcher.name} launcher, hidden from the home screen`
                }
            >
                <span
                    aria-hidden="true"
                    className={`size-1.5 shrink-0 rounded-full ${isPublished ? 'bg-emerald-500' : 'bg-muted-foreground'}`}
                />
                <span className="truncate">
                    {isPublished ? 'On ' : 'Hidden · '}
                    {launcher.name}
                </span>
            </Link>
        </Button>
    );
};

export default PublishToLauncherButton;
