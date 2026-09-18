import { Pencil } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { formatBinding, hasPrimaryModifier, IS_MAC, normalizeKeyEvent } from '@/hooks/keyboard-shortcuts/binding';
import type { ResolvedShortcut, ShortcutId, ShortcutSection } from '@/hooks/keyboard-shortcuts/types';
import { useKeyboardShortcuts } from '@/hooks/keyboard-shortcuts/use-keyboard-shortcuts';
import { cn } from '@/lib/utils';

interface Props {
    showHeading?: boolean;
    scrollClassName?: string;
}

const SECTION_LABELS: Record<ShortcutSection, string> = {
    composer: 'Composer',
    app: 'App',
};

const SECTION_ORDER: ShortcutSection[] = ['composer', 'app'];

// Non-rebindable rows whose default renders as more than one cap.
const STATIC_CAPS: Partial<Record<ShortcutId, string[]>> = {
    'recall-messages': ['↑', '↓'],
};

const ShortcutsPanel = ({ showHeading = false, scrollClassName }: Props) => {
    const { shortcuts, setEnabled, setBinding, restoreDefaults, findConflict } = useKeyboardShortcuts();

    const [capturingId, setCapturingId] = useState<ShortcutId | null>(null);
    const captureInputRef = useRef<HTMLInputElement>(null);

    // Focus the capture field once it mounts so the native caret shows and
    // keystrokes land here (autoFocus alone loses to Radix's focus scope).
    useEffect(() => {
        if (capturingId) {
            captureInputRef.current?.focus();
        }
    }, [capturingId]);

    const captureBinding = useCallback(
        (event: React.KeyboardEvent, id: ShortcutId) => {
            event.preventDefault();
            // Stop the native event from reaching the global shortcut listener.
            event.stopPropagation();

            if (event.code === 'Escape') {
                setCapturingId(null);

                return;
            }

            const binding = normalizeKeyEvent(event);

            // Wait for a real key: ignore standalone modifier presses.
            if (!binding) {
                return;
            }

            // Require a primary modifier so a rebind can't hijack plain typing.
            if (!hasPrimaryModifier(binding)) {
                toast.error(`Shortcut must include ${IS_MAC ? '⌘ or ⌃' : 'Ctrl'}.`);

                return;
            }

            const conflict = findConflict(binding, id);

            if (conflict) {
                toast.error(`That combination is already used by "${conflict.description}".`);
                setCapturingId(null);

                return;
            }

            setBinding(id, binding);
            setCapturingId(null);
        },
        [findConflict, setBinding],
    );

    const renderKeys = (shortcut: ResolvedShortcut, interactive = false) => {
        const caps = STATIC_CAPS[shortcut.id] ?? formatBinding(shortcut.binding);

        return caps.map((cap, index) => (
            <Kbd
                key={`${shortcut.id}-${index}`}
                className={cn(
                    'text-sm font-normal transition-colors',
                    interactive && 'group-hover:border-primary/40 group-hover:text-primary',
                )}
            >
                {cap}
            </Kbd>
        ));
    };

    const renderBindingControl = (shortcut: ResolvedShortcut) => {
        if (capturingId === shortcut.id) {
            return (
                <input
                    ref={captureInputRef}
                    type="text"
                    value=""
                    placeholder="Press key sequence"
                    onChange={() => undefined}
                    onKeyDown={(event) => captureBinding(event, shortcut.id)}
                    onBlur={() => setCapturingId(null)}
                    aria-label={`Recording shortcut for ${shortcut.description}`}
                    className="h-7 min-w-32 rounded-md bg-transparent px-1 text-center text-xs text-muted-foreground italic caret-foreground outline-none"
                />
            );
        }

        if (!shortcut.rebindable) {
            return <span className="flex h-7 items-center gap-1">{renderKeys(shortcut)}</span>;
        }

        return (
            <button
                type="button"
                disabled={!shortcut.enabled}
                onClick={() => setCapturingId(shortcut.id)}
                title="Click to rebind"
                className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Change shortcut for ${shortcut.description}`}
            >
                <Pencil
                    className={cn(
                        'size-3 text-muted-foreground opacity-0 transition-opacity',
                        shortcut.enabled && 'group-hover:opacity-100',
                    )}
                    aria-hidden
                />
                <span className="flex items-center gap-1">{renderKeys(shortcut, shortcut.enabled)}</span>
            </button>
        );
    };

    const renderRow = (shortcut: ResolvedShortcut) => (
        <div
            key={shortcut.id}
            className="keyboard-shortcuts-row group flex items-center justify-between gap-4 rounded-xl bg-card px-3 py-2 shadow-none"
        >
            <span className="keyboard-shortcuts-row-toggle flex min-w-0 items-center gap-3">
                <ToggleSwitch
                    checked={shortcut.enabled}
                    onCheckedChange={(checked) => setEnabled(shortcut.id, checked)}
                    aria-label={`Enable ${shortcut.description}`}
                />
                <span className="truncate text-sm text-foreground">{shortcut.description}</span>
            </span>
            <span className="shrink-0">{renderBindingControl(shortcut)}</span>
        </div>
    );

    const renderSection = (section: ShortcutSection) => {
        const rows = shortcuts.filter((shortcut) => shortcut.section === section);

        if (rows.length === 0) {
            return null;
        }

        return (
            <section key={section} className="keyboard-shortcuts-section flex flex-col gap-2.5">
                <span className="keyboard-shortcuts-section-label px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {SECTION_LABELS[section]}
                </span>
                <div className="keyboard-shortcuts-section-rows flex flex-col gap-2">{rows.map(renderRow)}</div>
            </section>
        );
    };

    return (
        <div className="keyboard-shortcuts-panel mx-auto flex w-full max-w-4xl flex-col">
            {showHeading && (
                <div className="keyboard-shortcuts-panel-heading mb-6 flex flex-col gap-1">
                    <h2 className="text-2xl font-semibold tracking-tight">Keyboard shortcuts</h2>
                    <p className="text-sm text-muted-foreground">Enable, disable, or rebind keyboard shortcuts.</p>
                </div>
            )}
            <div className={cn('flex flex-col gap-6', scrollClassName)}>{SECTION_ORDER.map(renderSection)}</div>
            <div className="mt-6 flex justify-end">
                <Button type="button" variant="secondary" onClick={restoreDefaults}>
                    Restore defaults
                </Button>
            </div>
        </div>
    );
};

export default ShortcutsPanel;
