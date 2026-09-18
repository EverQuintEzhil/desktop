import {
    ArrowLeftIcon,
    BellIcon,
    BrainCircuitIcon,
    CalendarClockIcon,
    History,
    ImagesIcon,
    KeyboardIcon,
    LightbulbIcon,
    SunMoonIcon,
    Plug,
    UserRoundIcon,
    XIcon,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

import { AvatarMenu } from '@/components';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { selectHideRoutines, selectTenant } from '@/store/selectors';

interface Props {
    isMobileOpen: boolean;
    onMobileClose: () => void;
    returnPath: string;
}

const navItemClass = ({ isActive }: { isActive: boolean }) =>
    cn('home-nav flex items-center gap-2 rounded-lg p-2', isActive && 'active');

const SettingsSidebar = ({ isMobileOpen, onMobileClose, returnPath }: Props) => {
    const navigate = useNavigate();
    const location = useLocation();
    const tenant = useSelector(selectTenant);
    const hideRoutinesForMe = useSelector(selectHideRoutines);

    const isSkillsNavActive = location.pathname.startsWith('/settings/skills');
    const isLibraryNavActive = location.pathname.startsWith('/settings/library');

    const goBack = () => {
        onMobileClose();
        navigate(returnPath);
    };

    return (
        <aside
            className={cn(
                'aside chat-sidebar settings-sidebar scrollbar-vertical flex flex-col',
                isMobileOpen && 'open',
            )}
        >
            <div className="aside-header flex items-center justify-between gap-2">
                <div className="brand-back flex items-center gap-2">
                    <div
                        className="brand-name relative flex items-center justify-center"
                        role="button"
                        tabIndex={0}
                        onClick={goBack}
                        onKeyDown={(e) => e.key === 'Enter' && goBack()}
                    >
                        <img src={tenant.logoWhite || tenant.logoHorizontal} alt={tenant.name} />
                        <div className="back-icon flex items-center justify-center">
                            <ArrowLeftIcon className="size-4" />
                        </div>
                    </div>
                </div>
                <Button
                    className="mobile-close rounded-full"
                    variant="secondary"
                    size="icon-xs"
                    aria-label="Close menu"
                    onClick={onMobileClose}
                >
                    <XIcon />
                </Button>
            </div>
            <div className="aside-body flex flex-col">
                <ul className="main-nav sticky-nav flex flex-col gap-0.5 p-2">
                    <li>
                        <NavLink
                            to="/settings/library"
                            className={navItemClass({ isActive: isLibraryNavActive })}
                            onClick={onMobileClose}
                        >
                            <ImagesIcon className="size-4" />
                            <span className="text-sm font-medium">Library</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/settings/connectors" className={navItemClass} onClick={onMobileClose}>
                            <Plug className="size-4" />
                            <span className="text-sm font-medium">Connectors</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                            to="/settings/skills"
                            className={navItemClass({ isActive: isSkillsNavActive })}
                            onClick={onMobileClose}
                        >
                            <LightbulbIcon className="size-4" />
                            <span className="text-sm font-medium">Skills</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                            to="/settings/memories"
                            className={navItemClass({ isActive: location.pathname.startsWith('/settings/memories') })}
                            onClick={onMobileClose}
                        >
                            <BrainCircuitIcon className="size-4" />
                            <span className="text-sm font-medium">Memories</span>
                        </NavLink>
                    </li>
                    {!hideRoutinesForMe && (
                        <li>
                            <NavLink to="/settings/routines" className={navItemClass} onClick={onMobileClose}>
                                <CalendarClockIcon className="size-4" />
                                <span className="text-sm font-medium">Routines</span>
                            </NavLink>
                        </li>
                    )}
                    <li>
                        <NavLink to="/settings/login-activities" className={navItemClass} onClick={onMobileClose}>
                            <History className="size-4" />
                            <span className="text-sm font-medium">Login Activities</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/settings/user" className={navItemClass} onClick={onMobileClose}>
                            <UserRoundIcon className="size-4" />
                            <span className="text-sm font-medium">Accounts</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/settings/notifications" className={navItemClass} onClick={onMobileClose}>
                            <BellIcon className="size-4" />
                            <span className="text-sm font-medium">Notifications</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/settings/appearance" className={navItemClass} onClick={onMobileClose}>
                            <SunMoonIcon className="size-4" />
                            <span className="text-sm font-medium">Appearance</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/settings/keyboard-shortcuts" className={navItemClass} onClick={onMobileClose}>
                            <KeyboardIcon className="size-4" />
                            <span className="text-sm font-medium">Keyboard shortcuts</span>
                        </NavLink>
                    </li>
                </ul>
            </div>
            <div className="aside-footer mt-auto flex items-center">
                <div className="avatar-menu-wrapper flex-1">
                    <AvatarMenu showName />
                </div>
            </div>
        </aside>
    );
};

export default SettingsSidebar;
