import { BuildingIcon, ChevronDownIcon, UserIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ANNOUNCEMENTS_PATH, HELP_CENTER_PATH } from '@/app/screens/private/screens/blogs/constants';
import { AvatarMenu, DropdownMenu } from '@/components';
import { Button } from '@/components/ui/button';
import Switch from '@/components/ui/switch';
import { useAppSelector } from '@/hooks';
import { selectHideDocumentationLinks, selectHideScopeSwitch, selectHideWhatsNew } from '@/store/selectors';
import type { TenantType } from '@/types/store';

import './home-header.scss';

/** One door on the header, two destinations behind it. */
const WHATS_NEW_LINKS = [
    { value: 'announcements', label: 'Announcements', to: ANNOUNCEMENTS_PATH },
    { value: 'help-center', label: 'Help Center', to: HELP_CENTER_PATH },
];

interface Props {
    tenant: TenantType;
    scope: 'my' | 'firm';
    onScopeChange: (scope: 'my' | 'firm') => void;
}

const HomeHeader = (props: Props) => {
    const { tenant, scope, onScopeChange } = props;
    const [isSticky, setIsSticky] = useState<boolean>(false);
    const hideWhatsNew = useAppSelector(selectHideWhatsNew);
    const hideScopeSwitch = useAppSelector(selectHideScopeSwitch);
    const hideDocumentationLinks = useAppSelector(selectHideDocumentationLinks);
    const documentationLinks = tenant.documentationLinks;

    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            setIsSticky(scrollTop > 0);
        };

        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const renderWhatsNewMenu = () => (
        <DropdownMenu
            trigger={
                <Button
                    variant="outline"
                    size="default"
                    className="h-9 shrink items-center gap-2 rounded-full border-primary"
                >
                    What&apos;s New
                    <ChevronDownIcon aria-hidden className="shrink-0" />
                </Button>
            }
            contentClassName="p-2 w-auto min-w-[200px]"
            itemClassName="home-header-menu-item p-0 hover:bg-transparent"
            options={WHATS_NEW_LINKS.map((link) => ({
                value: link.value,
                label: (
                    <Link
                        to={link.to}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full rounded-md p-2 outline-none"
                    >
                        <span className="text-sm font-normal">{link.label}</span>
                    </Link>
                ),
            }))}
        />
    );

    const renderAboutMenu = () => (
        <DropdownMenu
            trigger={
                <Button
                    variant="secondary"
                    size="default"
                    className={
                        'h-auto min-h-9 max-w-full min-w-0 shrink items-center justify-between gap-2 select-none ' +
                        'rounded-full py-0.5 text-left whitespace-normal'
                    }
                >
                    <span className="min-w-0 flex-1 leading-snug wrap-break-word">About {tenant.name}</span>
                    <ChevronDownIcon aria-hidden className="mt-0.5 shrink-0" />
                </Button>
            }
            contentClassName="p-2 w-auto min-w-[200px]"
            itemClassName="home-header-menu-item p-0 hover:bg-transparent"
            options={documentationLinks.map((link) => ({
                value: link.id,
                label: (
                    <Link
                        to={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full rounded-md p-2 outline-none"
                    >
                        <span className="text-sm font-normal">{link.label}</span>
                    </Link>
                ),
            }))}
        />
    );

    return (
        <header className={`header z-2 bg-background py-4 ${isSticky ? 'sticky top-0' : ''}`}>
            <div className="mx-auto flex w-full max-w-[1520px] min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 px-4 lg:px-10">
                {hideWhatsNew ? null : renderWhatsNewMenu()}
                {hideScopeSwitch ? null : (
                    <Switch
                        options={[
                            { label: 'My', icon: UserIcon },
                            { label: 'Firmwide', icon: BuildingIcon },
                        ]}
                        activeIndex={scope === 'my' ? 0 : 1}
                        onChange={(_, index) => onScopeChange(index === 0 ? 'my' : 'firm')}
                        color="primary"
                        width={{
                            default: 100,
                            sm: 36,
                        }}
                        removeLabelMobile={{
                            sm: true,
                        }}
                    />
                )}
                {hideDocumentationLinks || documentationLinks.length === 0 ? null : renderAboutMenu()}
                <AvatarMenu />
            </div>
        </header>
    );
};

export default HomeHeader;
