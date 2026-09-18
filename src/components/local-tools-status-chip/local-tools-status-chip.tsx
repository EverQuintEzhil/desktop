import { useLocalToolsStatus } from '@/lib/local-tools';

interface Props {
    folderPath: string | null;
    /** Chip is meaningless for agents without Spaces — `folderPath` alone cannot distinguish that. */
    spacesEnabled: boolean;
}

/**
 * Always-on attach indicator for the local coding tools (desktop only). The
 * failure mode it exists for: the agent's system prompt describes the tools,
 * but they are not attached to this chat — the model then "knows" tools it
 * cannot call and misfires on server-side ones (observed: run_python /
 * read_artifact loops). Hover for the actionable detail.
 */
const LocalToolsStatusChip = ({ folderPath, spacesEnabled }: Props) => {
    const status = useLocalToolsStatus(folderPath);

    if (!spacesEnabled || status.state === 'unsupported') {
        return null;
    }

    const chip = (() => {
        switch (status.state) {
            case 'no-folder':
                return {
                    className: 'border-border text-muted-foreground',
                    label: 'Local tools off',
                    title: 'This chat has no local coding tools. Set a "Local folder path" on this Space (Edit space) and start the chat inside the Space.',
                };
            case 'loading':
                return {
                    className: 'border-border text-muted-foreground',
                    label: 'Local tools…',
                    title: 'Fetching the tool manifest from agent-core…',
                };
            case 'error':
                return {
                    className: 'border-destructive/40 text-destructive',
                    label: 'Local tools error',
                    title: status.message,
                };
            case 'active':
                return {
                    className: 'border-border text-primary',
                    label: `Local tools · ${status.count}`,
                    title: `Attached to this chat, rooted at ${status.root}`,
                };
        }
    })();

    return (
        <span
            title={chip.title}
            data-state={status.state}
            className={`fixed bottom-36 right-4 z-40 cursor-default rounded-full border bg-background px-2.5 py-1 font-mono text-[11px] shadow-sm ${chip.className}`}
        >
            {chip.label}
        </span>
    );
};

export default LocalToolsStatusChip;
