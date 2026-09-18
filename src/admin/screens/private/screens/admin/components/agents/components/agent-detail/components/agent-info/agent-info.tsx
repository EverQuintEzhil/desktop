import { useForm } from '@tanstack/react-form';
import { CheckIcon, PencilIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import SpinnerBlade from '@/components/ui/spinner';
import TextAreaForm from '@/components/ui/textarea-form';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { useUpdateAgentMutation } from '@/lib/api/admin/agents';
import type { UserType, AgentType } from '@/types/admin';

import { SecurityGroupEdit } from '../../../../../security-group-edit';
import { UsersEdit } from '../../../../../users-edit';

import AgentAccessWarning from './components/agent-access-warning';

interface Props {
    agent: AgentType;
    canUserEdit: boolean;
    onSubmit: (value: AgentType) => void;
    isAppView?: boolean;
}

const AgentInfo = (props: Props) => {
    const { agent, onSubmit, canUserEdit, isAppView } = props;
    const params = useParams();
    const [isEditing, setIsEditing] = useState<'' | 'description' | 'mcpExposable'>('');

    const updateMutation = useUpdateAgentMutation();
    const isSubmitting = updateMutation.isPending;

    const onSave = async (
        value: { description: string; mcpExposable: boolean },
        editingOverride?: 'mcpExposable',
    ): Promise<boolean> => {
        try {
            const activeEdit = editingOverride || isEditing;
            const obj: { description?: string; mcpExposable?: boolean } = {};

            if (activeEdit === 'mcpExposable') {
                obj.mcpExposable = value.mcpExposable;
            } else if (activeEdit === 'description') {
                obj.description = value.description;
            } else {
                return false;
            }

            const updatedAgent = await updateMutation.mutateAsync({
                id: agent._id,
                data: obj,
                routeSlugOrId: params.agentId,
            });

            onSubmit(updatedAgent as AgentType);

            return true;
        } catch (error) {
            console.error(error);

            return false;
        } finally {
            setIsEditing('');
        }
    };

    const form = useForm({
        defaultValues: {
            mcpExposable: agent?.mcpExposable || false,
            description: agent?.description || '',
        },
        onSubmit: async ({ value }) => {
            await onSave(value);
        },
    });

    return (
        <div className="tab-content agent-tab agent-border flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h4>MCP Exposable</h4>
                <form.Field
                    name={'mcpExposable'}
                    children={(field) => (
                        <ToggleSwitch
                            checked={field.state.value}
                            onCheckedChange={async (checked) => {
                                const previousValue = field.state.value;

                                field.handleChange(checked);
                                setIsEditing('mcpExposable');
                                const isSaveSuccessful = await onSave(
                                    {
                                        ...form.state.values,
                                        mcpExposable: checked,
                                    },
                                    'mcpExposable',
                                );

                                if (!isSaveSuccessful) {
                                    field.handleChange(previousValue);
                                }
                            }}
                            disabled={
                                !canUserEdit || isSubmitting || (isEditing !== '' && isEditing !== 'mcpExposable')
                            }
                            tabIndex={-1}
                            aria-hidden
                        />
                    )}
                />
            </div>
            <div className="description-block hover-me flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <h4>Description</h4>
                    {isEditing === 'description' ? (
                        <div className="launcher-info-actions flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon-sm" onClick={() => setIsEditing('')}>
                                <XIcon />
                            </Button>
                            <Button size="icon-sm" disabled={isSubmitting} onClick={form.handleSubmit}>
                                {isSubmitting ? <SpinnerBlade className="scale-75" /> : <CheckIcon />}
                            </Button>
                        </div>
                    ) : (
                        canUserEdit && (
                            <SimpleTooltip content="Edit" side="bottom">
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="on-hover"
                                    onClick={() => setIsEditing('description')}
                                >
                                    <PencilIcon />
                                </Button>
                            </SimpleTooltip>
                        )
                    )}
                </div>
                {isEditing === 'description' ? (
                    <div className="launcher-info-editor launcher-info-textarea flex flex-col gap-2">
                        <form.Field
                            name="description"
                            children={(field) => (
                                <TextAreaForm
                                    name={field.name}
                                    isErrored={false}
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(val) => field.handleChange(val)}
                                />
                            )}
                        />
                    </div>
                ) : (
                    <p
                        className="decription-readable"
                        onClick={() => canUserEdit && setIsEditing('description')}
                        role="presentation"
                    >
                        {agent.description}
                    </p>
                )}
            </div>
            {!isAppView && (
                <>
                    <UsersEdit
                        users={(agent.admins || []) as UserType[]}
                        title="Admins"
                        id={agent._id}
                        type={'agents'}
                        canUserEdit={canUserEdit}
                        field="adminIds"
                        onSubmit={onSubmit}
                    />
                    <UsersEdit
                        users={agent.includeUsers || []}
                        title="Included Users"
                        id={agent._id}
                        type={'agents'}
                        canUserEdit={canUserEdit}
                        field="includeUserIds"
                        onSubmit={onSubmit}
                        renderHeaderAction={() => (
                            <AgentAccessWarning agent={agent} principalKind="user" canUserEdit={canUserEdit} />
                        )}
                    />
                    <SecurityGroupEdit
                        securityGroups={agent.includeSecurityGroups || []}
                        title="Included Security Groups"
                        id={agent._id}
                        type={'agents'}
                        canUserEdit={canUserEdit}
                        field="includeSecurityGroupIds"
                        onSubmit={onSubmit}
                        renderHeaderAction={() => (
                            <AgentAccessWarning agent={agent} principalKind="securityGroup" canUserEdit={canUserEdit} />
                        )}
                    />
                    <UsersEdit
                        users={agent.excludeUsers || []}
                        title="Excluded Users"
                        id={agent._id}
                        type={'agents'}
                        canUserEdit={canUserEdit}
                        field="excludeUserIds"
                        onSubmit={onSubmit}
                    />
                    <SecurityGroupEdit
                        securityGroups={agent.excludeSecurityGroups || []}
                        title="Excluded Security Groups"
                        id={agent._id}
                        type={'agents'}
                        canUserEdit={canUserEdit}
                        field="excludeSecurityGroupIds"
                        onSubmit={onSubmit}
                    />
                </>
            )}
        </div>
    );
};

export default AgentInfo;
