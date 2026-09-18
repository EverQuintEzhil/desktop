import { Label } from '@/components/ui/label';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import type { AgentSettingsType } from '@/types/admin';

export type AgentAccessFlagKey = keyof AgentSettingsType;

// `label` omits the resource word because the card title beside it already supplies it;
// `accessibleLabel` spells it out, since all four switches are on screen at once and a screen
// reader gets no such context from the heading.
const FLAG_LABELS: Record<AgentAccessFlagKey, { label: string; accessibleLabel: string; description: string }> = {
    allowCustomSkills: {
        label: 'Allow custom',
        accessibleLabel: 'Allow custom skills',
        description: 'Users can use skills they created',
    },
    allowSharedSkills: {
        label: 'Allow enterprise',
        accessibleLabel: 'Allow enterprise skills',
        description: 'Users can use enterprise skills available to them',
    },
    allowCustomConnectors: {
        label: 'Allow custom',
        accessibleLabel: 'Allow custom connectors',
        description: 'Users can use connectors they created',
    },
    allowSharedConnectors: {
        label: 'Allow enterprise',
        accessibleLabel: 'Allow enterprise connectors',
        description: 'Users can use enterprise connectors available to them',
    },
};

interface Props {
    settings: Required<AgentSettingsType>;
    canUserEdit: boolean;
    flagKeys: AgentAccessFlagKey[];
    onToggle: (key: AgentAccessFlagKey, checked: boolean) => void;
}

const AgentAccessFlags = (props: Props) => {
    const { settings, canUserEdit, flagKeys, onToggle } = props;

    const renderFlag = (key: AgentAccessFlagKey) => {
        const { label, accessibleLabel, description } = FLAG_LABELS[key];
        const switchId = `agent-access-flag-${key}`;

        return (
            <SimpleTooltip key={key} content={description}>
                <span className="flex items-center gap-2">
                    <Label htmlFor={switchId} className="cursor-pointer text-xs font-normal text-text-secondary">
                        {label}
                    </Label>
                    <ToggleSwitch
                        id={switchId}
                        aria-label={accessibleLabel}
                        disabled={!canUserEdit}
                        checked={settings[key]}
                        onCheckedChange={(checked) => onToggle(key, checked)}
                    />
                </span>
            </SimpleTooltip>
        );
    };

    return <div className="agent-access-flags flex items-center gap-4">{flagKeys.map(renderFlag)}</div>;
};

export default AgentAccessFlags;
