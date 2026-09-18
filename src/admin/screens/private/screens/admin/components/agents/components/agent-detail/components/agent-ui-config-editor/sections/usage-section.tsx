import { GaugeIcon } from 'lucide-react';

import { CheckboxShadcn } from '@/components/ui/checkbox';

import AccordionSection from '../components/primitives/accordion-section';
import FormRow from '../components/primitives/form-row';
import { USAGE_ROLES, type ChatUiConfig, type UsageSchemaType } from '../schema';

type UsageRole = (typeof USAGE_ROLES)[number];

const ROLE_LABELS: Record<UsageRole, string> = {
    admin: 'Admin',
    owner: 'Owner',
    developer: 'Developer',
    user: 'User',
};

interface Props {
    value: ChatUiConfig['usage'];
    onChange: (next: ChatUiConfig['usage']) => void;
    disabled?: boolean;
    errorCount?: number;
}

const normalizeUsage = (next: UsageSchemaType): UsageSchemaType | undefined => {
    // An empty role list means nobody, which is what the Hide checkbox says. Collapsing it keeps the
    // form honest: a saved config that hides usage always shows Hide as checked.
    const noRolesLeft = next.visibleToRoles?.length === 0;
    const hidden = next.hidden === true || noRolesLeft ? true : undefined;
    const visibleToRoles =
        !noRolesLeft && next.visibleToRoles && next.visibleToRoles.length < USAGE_ROLES.length
            ? next.visibleToRoles
            : undefined;

    if (hidden === undefined && visibleToRoles === undefined) return undefined;

    return { ...(hidden === undefined ? {} : { hidden }), ...(visibleToRoles === undefined ? {} : { visibleToRoles }) };
};

const UsageSection = ({ value, onChange, disabled, errorCount }: Props) => {
    const hidden = value?.hidden ?? false;
    const selectedRoles = value?.visibleToRoles ?? [...USAGE_ROLES];

    const handleHiddenChange = (checked: boolean) => {
        if (disabled) return;

        onChange(normalizeUsage({ ...value, hidden: checked }));
    };

    const handleRoleChange = (role: UsageRole, checked: boolean) => {
        if (disabled) return;

        const nextRoles = checked
            ? USAGE_ROLES.filter((candidate) => candidate === role || selectedRoles.includes(candidate))
            : selectedRoles.filter((candidate) => candidate !== role);

        onChange(normalizeUsage({ ...value, visibleToRoles: [...nextRoles] }));
    };

    const renderRoleCheckbox = (role: UsageRole) => (
        <label key={role} className="flex cursor-pointer items-center gap-2.5">
            <CheckboxShadcn
                disabled={disabled || hidden}
                checked={selectedRoles.includes(role)}
                aria-label={ROLE_LABELS[role]}
                onCheckedChange={(c) => handleRoleChange(role, c === true)}
            />
            <span className="text-sm font-medium">{ROLE_LABELS[role]}</span>
        </label>
    );

    return (
        <AccordionSection
            id="usage"
            title="AI usage"
            icon={<GaugeIcon className="size-3.5" />}
            required={false}
            description="Who can see token counts, estimated cost and CO2 for this agent."
            errorCount={errorCount}
        >
            <div className="-mx-4 -mb-4 border-t border-border">
                <FormRow label="Visibility" sub="Hides usage from everyone on this agent">
                    <label className="flex cursor-pointer items-center gap-2.5">
                        <CheckboxShadcn
                            disabled={disabled}
                            checked={hidden}
                            aria-label="Hide AI usage"
                            onCheckedChange={(c) => handleHiddenChange(c === true)}
                        />
                        <span className="text-sm font-medium">Hide AI usage</span>
                    </label>
                </FormRow>
                <FormRow
                    label="Visible to roles"
                    sub="Leave all four checked to show usage to everyone"
                    className={hidden ? 'opacity-60' : undefined}
                >
                    <div className="flex flex-wrap gap-x-6 gap-y-2">{USAGE_ROLES.map(renderRoleCheckbox)}</div>
                </FormRow>
            </div>
        </AccordionSection>
    );
};

export default UsageSection;
