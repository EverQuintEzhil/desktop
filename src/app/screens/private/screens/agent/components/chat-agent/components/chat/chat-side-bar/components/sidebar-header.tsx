import { ArrowLeftIcon, PanelLeftIcon, PanelRightIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';
import type { TenantType } from '@/types/store';

interface Props {
    tenant: TenantType;
    isPreview: boolean;
    isCollapsed: boolean;
    onMobileClose?: () => void;
    onBrandBack: () => void;
    onToggleSidebar: () => void;
}

const SidebarHeader = (props: Props) => {
    const { tenant, isPreview, isCollapsed, onMobileClose, onBrandBack, onToggleSidebar } = props;

    return (
        <div className="aside-header flex items-center justify-between gap-2">
            <div className="brand-back flex items-center gap-2">
                <div
                    className="brand-name relative flex items-center justify-center"
                    onClick={onBrandBack}
                    role="button"
                    tabIndex={0}
                    title={isPreview ? 'Back to builder' : undefined}
                    onKeyDown={(e) => e.key === 'Enter' && onBrandBack()}
                >
                    <img src={tenant.logoWhite ? tenant.logoWhite : tenant.logoHorizontal} alt={tenant.name} />
                    <div className="back-icon flex items-center justify-center">
                        <ArrowLeftIcon className="size-4" />
                    </div>
                </div>
            </div>
            <SimpleTooltip content={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} side="right">
                <Button
                    variant="ghost"
                    className={cn(
                        'toggle-button flex h-8 w-8 cursor-pointer items-center justify-center p-0 hover:bg-transparent',
                    )}
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    aria-expanded={!isCollapsed}
                    onClick={onToggleSidebar}
                >
                    {isCollapsed ? (
                        <div className="brand-name toggle-button-brand flex items-center justify-center">
                            <img src={tenant.logoWhite ? tenant.logoWhite : tenant.logoHorizontal} alt={tenant.name} />
                            <div className="back-icon flex items-center justify-center">
                                <PanelLeftIcon className="size-4" />
                            </div>
                        </div>
                    ) : (
                        <PanelRightIcon className="size-4 text-white" />
                    )}
                </Button>
            </SimpleTooltip>
            <SimpleTooltip content="Close">
                <Button
                    className="mobile-close rounded-full"
                    variant="secondary"
                    size="icon-xs"
                    aria-label="Close sidebar"
                    onClick={onMobileClose}
                >
                    <XIcon />
                </Button>
            </SimpleTooltip>
        </div>
    );
};

export type { Props as SidebarHeaderProps };
export default SidebarHeader;
