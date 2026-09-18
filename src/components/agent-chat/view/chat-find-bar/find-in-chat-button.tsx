import { SearchIcon } from 'lucide-react';
import type { Ref } from 'react';

import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { formatBinding } from '@/hooks/keyboard-shortcuts/binding';
import { useKeyboardShortcuts } from '@/hooks/keyboard-shortcuts/use-keyboard-shortcuts';

import { useFindContext } from './find-context';

/**
 * Split from the gate below so the shortcut lookup — which reads the signed-in
 * profile — never runs on a surface that cannot search in the first place.
 */
const FindInChatControl = ({
    onOpen,
    controlRef,
    compact,
}: {
    onOpen?: () => void;
    controlRef?: Ref<HTMLButtonElement>;
    compact: boolean;
}) => {
    const { shortcuts } = useKeyboardShortcuts();
    const shortcut = shortcuts.find((entry) => entry.id === 'find-in-chat');

    // Read from the resolved shortcut rather than hard-coding ⌘F, so a rebind or a
    // disabled shortcut is reflected instead of advertising a key that does nothing.
    const keys = shortcut?.enabled ? formatBinding(shortcut.binding) : null;

    return (
        <Button
            ref={controlRef}
            variant="outline"
            size="xs"
            aria-label="Find in chat"
            onClick={onOpen}
            className="find-in-chat-button shrink-0 gap-1.5 rounded-full"
        >
            <SearchIcon className="size-3.5" />
            {!compact && (
                <>
                    <span className="max-lg:hidden">Find in chat</span>
                    {keys && (
                        <Kbd className="h-4 min-w-4 border-transparent bg-transparent px-0.5 text-[10px] text-current max-lg:hidden">
                            {keys.join('')}
                        </Kbd>
                    )}
                </>
            )}
        </Button>
    );
};

/**
 * Header control that opens the find bar, so the feature is discoverable without
 * the shortcut. `isPlaceholder` keeps it rendered while find is open — the header
 * measures the hidden row to size the bar — without claiming the focus-return ref.
 */
const FindInChatButton = ({
    compact = false,
    isPlaceholder = false,
}: {
    compact?: boolean;
    isPlaceholder?: boolean;
}) => {
    const context = useFindContext();

    if (!context?.isEnabled) return null;

    if (isPlaceholder) return <FindInChatControl compact={compact} />;

    if (context.isOpen) return null;

    return <FindInChatControl onOpen={context.open} controlRef={context.controlRef} compact={compact} />;
};

export default FindInChatButton;
