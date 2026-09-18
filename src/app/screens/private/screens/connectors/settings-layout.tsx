import { MenuIcon } from 'lucide-react';
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import SettingsSidebar from './settings-sidebar';

const RETURN_PATH_STORAGE_KEY = 'settings:return-path';

const SettingsLayout = () => {
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const location = useLocation();
    const [returnPath] = useState<string>(() => {
        const state = location.state as { from?: string } | null;

        if (state?.from) {
            sessionStorage.setItem(RETURN_PATH_STORAGE_KEY, state.from);

            return state.from;
        }

        return sessionStorage.getItem(RETURN_PATH_STORAGE_KEY) ?? '/';
    });

    return (
        <>
            <Button
                className="mobile-menu-button mobile-menu rounded-full"
                variant="secondary"
                size="icon-sm"
                aria-label="Open menu"
                onClick={() => setIsMobileOpen((v) => !v)}
            >
                <MenuIcon />
            </Button>
            <div
                className={cn('mobile-overlay', isMobileOpen && 'visible')}
                role="presentation"
                onClick={() => setIsMobileOpen(false)}
            />
            <div className="flex h-svh w-full overflow-hidden bg-background">
                <SettingsSidebar
                    isMobileOpen={isMobileOpen}
                    onMobileClose={() => setIsMobileOpen(false)}
                    returnPath={returnPath}
                />
                <div className="content-area flex min-w-0 flex-1 flex-col overflow-hidden">
                    <div
                        className={cn(
                            'scrollbar-controller scrollbar-vertical min-h-0 w-full flex-1 px-4 pt-14 pb-6 lg:px-8 lg:py-6',
                            'has-[.library-container]:p-0! lg:has-[.library-container]:p-0!',
                            'has-[.library-container]:overflow-hidden',
                        )}
                    >
                        <Outlet />
                    </div>
                </div>
            </div>
        </>
    );
};

export default SettingsLayout;
