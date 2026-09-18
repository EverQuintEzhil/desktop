import { useChatShell } from '@/components/agent-chat/context/chat-shell-context';
import { useAppSelector } from '@/hooks';
import { cn } from '@/lib/utils';
import { selectTenant } from '@/store/selectors';

export default function AgentFooter() {
    const tenant = useAppSelector(selectTenant);
    const { variant } = useChatShell();
    // The assistant panel is 340-640px wide however wide the window is, so the viewport
    // breakpoint would pin the footer over the starter questions; it stays in flow there.
    const isPanel = variant === 'panel';

    return (
        <footer
            className={cn(
                'footer-container flex w-full max-w-[800px] items-center justify-center px-4',
                'static mt-4 pb-4',
                !isPanel && 'lg:absolute lg:bottom-4 lg:left-1/2 lg:mt-0 lg:-translate-x-1/2 lg:pb-0',
            )}
        >
            <span className="text-xs font-medium text-primary">
                {tenant?.footerText || 'AI can make mistakes. Please check your work.'}
            </span>
        </footer>
    );
}
