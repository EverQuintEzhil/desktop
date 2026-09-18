import { Ban, CircleCheck, Hand, type LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import type { ToolPermission } from '../../hooks/use-connector-queries';

import './permission-switch.scss';

interface PermissionOption {
    value: ToolPermission;
    label: string;
    shortLabel: string;
    icon: LucideIcon;
}

const PERMISSION_INDEX: Record<ToolPermission, number> = {
    always_allow: 0,
    needs_approval: 1,
    blocked: 2,
};

const ACCENT_CLASS: Record<ToolPermission, string> = {
    always_allow: 'permission-switch--allow',
    needs_approval: 'permission-switch--ask',
    blocked: 'permission-switch--block',
};

export const PERMISSION_SWITCH_OPTIONS: PermissionOption[] = [
    {
        value: 'always_allow',
        label: 'Always allow',
        shortLabel: 'Allow',
        icon: CircleCheck,
    },
    {
        value: 'needs_approval',
        label: 'Needs approval',
        shortLabel: 'Ask',
        icon: Hand,
    },
    {
        value: 'blocked',
        label: 'Blocked',
        shortLabel: 'Block',
        icon: Ban,
    },
];

interface PermissionSwitchProps {
    value: ToolPermission | null;
    onChange: (value: ToolPermission) => void;
}

export const PermissionSwitch = ({ value, onChange }: PermissionSwitchProps) => {
    const activeIndex = value ? PERMISSION_INDEX[value] : 0;

    return (
        <ToggleGroup
            type="single"
            value={value ?? ''}
            onValueChange={() => {}}
            className={cn(
                'permission-switch ml-auto shrink-0 border border-border-secondary shadow-none',
                value && ACCENT_CLASS[value],
            )}
            style={{ '--active-index': activeIndex } as CSSProperties}
            onClick={(event) => {
                event.stopPropagation();
            }}
        >
            {value ? <div className="permission-switch-indicator" aria-hidden="true" /> : null}
            {PERMISSION_SWITCH_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = value === option.value;

                return (
                    <ToggleGroupItem
                        key={option.value}
                        value={option.value}
                        aria-label={option.label}
                        className={cn('permission-switch-item transition-none!', isActive && 'active')}
                        onClick={() => {
                            if (!isActive) {
                                onChange(option.value);
                            }
                        }}
                    >
                        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="permission-switch-label">{option.shortLabel}</span>
                    </ToggleGroupItem>
                );
            })}
        </ToggleGroup>
    );
};
