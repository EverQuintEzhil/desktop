import { HomeIcon, LogOutIcon, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useChatShell } from '@/components/agent-chat/context/chat-shell-context';
import Avatar from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppSelector } from '@/hooks';
import { getFilesDownloadUrl } from '@/lib/axios';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';

import './avatar-menu.scss';

export type AvatarMenuPopupPosition = 'trigger' | 'top-right-edge';

interface Props {
    showName?: boolean;
    popupPosition?: AvatarMenuPopupPosition;
}

const defaultPlaceholder = 'https://assets.hub.perkinswill.com/default-user.svg';

const AvatarMenu = (props: Props) => {
    const { showName = false, popupPosition = 'trigger' } = props;
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const { isPreview } = useChatShell();
    const user = useAppSelector(selectUser);

    const location = useLocation();

    const isHomePage = location.pathname === '/';
    const isAdminPage = location.pathname.startsWith('/admin');

    const avatarBlock = user.avatar ? (
        <Avatar
            alt={`${user.name.first} ${user.name.last}`}
            src={getFilesDownloadUrl(user.avatar)}
            placeholder={defaultPlaceholder}
        />
    ) : (
        <Avatar initials alt={`${user.name.first} ${user.name.last}`} placeholder={defaultPlaceholder} />
    );

    const handleLogout = () => {
        setOpen(false);
        navigate('/logout');
    };

    const handleSettingsClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        setOpen(false);

        // Let the browser handle new-tab/new-window intents on the href
        const isModifiedClick = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

        if (isModifiedClick || isAdminPage) {
            return;
        }

        event.preventDefault();
        navigate('/settings/user', {
            state: { from: `${location.pathname}${location.search}` },
        });
    };

    const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const items = Array.from(event.currentTarget.querySelectorAll('.avatar-menu-action')) as HTMLElement[];

        if (items.length === 0) {
            return;
        }

        const currentIndex = items.indexOf(document.activeElement as HTMLElement);

        const focusItem = (index: number) => {
            event.preventDefault();
            items[index].focus();
        };

        if (event.key === 'ArrowDown') {
            const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;

            focusItem(nextIndex);

            return;
        }

        if (event.key === 'ArrowUp') {
            const previousIndex =
                currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;

            focusItem(previousIndex);

            return;
        }

        if (event.key === 'Home') {
            focusItem(0);

            return;
        }

        if (event.key === 'End') {
            focusItem(items.length - 1);
        }
    };

    useEffect(() => {
        if (!open) {
            return;
        }

        const handleViewportChange = () => setOpen(false);
        const handlePointerDown = (e: PointerEvent) => {
            const target = e.target as HTMLElement;

            // Allow clicks inside the popup to propagate normally
            if (target.closest('.avatar-menu-popup')) return;
            // Let the trigger handle its own clicks to toggle
            if (target.closest('.avatar-menu')) return;

            setOpen(false);
        };

        window.addEventListener('resize', handleViewportChange);
        document.addEventListener('pointerdown', handlePointerDown, { capture: true });

        return () => {
            window.removeEventListener('resize', handleViewportChange);
            document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
        };
    }, [open]);

    return (
        <div className="avatar-menu-wrapper flex items-center justify-center">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            'avatar-menu cursor-pointer border-0 bg-transparent p-0 text-inherit outline-none select-none',
                            'focus-visible:rounded-full focus-visible:ring-1 focus-visible:ring-(--color-focus-ring)',
                            showName ? 'flex w-full items-center gap-2' : 'avatar-menu--compact',
                        )}
                    >
                        {avatarBlock}
                        {showName && (
                            <span className="avatar-menu-name text-left font-medium">
                                {user.name.first} {user.name.last}
                            </span>
                        )}
                    </button>
                </PopoverTrigger>

                {open && (
                    <PopoverContent
                        align={popupPosition === 'top-right-edge' ? 'end' : 'center'}
                        hideWhenDetached
                        sideOffset={4}
                        className="avatar-menu-popup min-w-52 p-1"
                        onKeyDown={handleMenuKeyDown}
                        onOpenAutoFocus={(event) => event.preventDefault()}
                    >
                        <div className="avatar-menu-label flex flex-col gap-0.5 px-3 py-2">
                            <span className="text-base font-medium">
                                {user.name.first} {user.name.last}
                            </span>
                            <span className="text-sm font-normal text-text-secondary">{user.email}</span>
                        </div>

                        {!isPreview && !isHomePage && (
                            <a
                                href={window.location.origin}
                                rel="noopener noreferrer"
                                className="avatar-menu-action"
                                onClick={() => setOpen(false)}
                            >
                                <HomeIcon className="size-5 text-primary" />
                                <span className="text-base font-medium">Home</span>
                            </a>
                        )}

                        {/* Desktop build has no admin surface — the web app's Admin
                            menu entry is intentionally absent here. */}

                        <a
                            href={`${window.location.origin}/settings/user`}
                            rel="noopener noreferrer"
                            className="avatar-menu-action"
                            onClick={handleSettingsClick}
                        >
                            <Settings className="size-5 text-primary" />
                            <span className="text-base font-medium">Settings</span>
                        </a>

                        {!isPreview && (
                            <button
                                type="button"
                                className="avatar-menu-action avatar-menu-logout justify-center"
                                onClick={handleLogout}
                            >
                                <LogOutIcon className="size-5" />
                                <span className="text-base font-medium">Logout</span>
                            </button>
                        )}
                    </PopoverContent>
                )}
            </Popover>
        </div>
    );
};

export default AvatarMenu;
