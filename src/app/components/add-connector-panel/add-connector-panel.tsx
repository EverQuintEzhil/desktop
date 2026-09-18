import { useForm, useStore } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, PlugIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { pickerFormWrapCls } from '@/app/components/picker/picker-shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import TextAreaForm from '@/components/ui/textarea-form';
import { useCreateMcpMutation, useUpdateMcpMutation } from '@/lib/api/admin/mcps';
import { cn } from '@/lib/utils';
import { AUTH_TYPE_OPTIONS, CREDENTIAL_AUTH_TYPES, type McpType } from '@/types/admin';
import { showSuccessToast } from '@/utils';
import { getSafeHttpUrl } from '@/utils/url';

import {
    buildAuthCredentials,
    CredentialInput,
    DEFAULT_API_KEY_HEADER,
    getClientCredentialsError,
} from './auth-credentials';
import { DcrToggle } from './dcr-toggle';

interface ConnectorItem {
    _id: string;
    name: string;
    description?: string;
}

export interface EditableConnector {
    _id: string;
    name: string;
    description?: string | null;
    serverUrl: string;
    authType: string;
    isDcr?: boolean;
}

interface AddConnectorPanelProps {
    server?: EditableConnector;
    onBack: () => void;
    onClose: () => void;
    onSuccess: (connector: ConnectorItem) => void;
}

const btnCls =
    'rounded-xl text-text-secondary hover:text-primary hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))]';

const getAuthTypeOption = (value: string) => ({
    value,
    label: AUTH_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value,
});

const renderSubmitLabel = (isEditMode: boolean, isBusy: boolean): string => {
    if (isEditMode) {
        return isBusy ? 'Saving...' : 'Save changes';
    }

    return isBusy ? 'Creating...' : 'Create connector';
};

export const AddConnectorPanel = ({ server, onBack, onClose, onSuccess }: AddConnectorPanelProps) => {
    const queryClient = useQueryClient();
    const createMutation = useCreateMcpMutation();
    const updateMutation = useUpdateMcpMutation();
    const [formError, setFormError] = useState('');
    const [isDcrTouched, setIsDcrTouched] = useState(false);
    const credentialsRef = useRef<HTMLDivElement>(null);
    const isEditMode = !!server;

    const wasOauth = server?.authType === 'oauth';

    // A connector already saved as manual OAuth keeps its stored credentials; anything else has none to fall back
    // on, so a stale isDcr left over from another auth type must not suppress the credential check.
    const wasManualOauth = wasOauth && server?.isDcr === false;

    // The toggle has to show something, but an absent isDcr is unknown, not "yes" — only send what the user set or
    // what the connector already reported. Switching an existing connector to OAuth is new ground, same as a create.
    const shouldSendIsDcr = (authType: string) =>
        authType === 'oauth' && (!isEditMode || isDcrTouched || !wasOauth || server?.isDcr !== undefined);

    const form = useForm({
        defaultValues: {
            name: server?.name ?? '',
            description: server?.description ?? '',
            authType: server ? getAuthTypeOption(server.authType) : { value: 'none', label: 'None' },
            apiKeyHeader: DEFAULT_API_KEY_HEADER,
            apiKey: '',
            token: '',
            username: '',
            password: '',
            isDcr: server?.isDcr ?? true,
            clientId: '',
            clientSecret: '',
            serverUrl: server?.serverUrl ?? '',
        },
        onSubmit: async ({ value }) => {
            setFormError('');
            try {
                const serverUrlSafe = getSafeHttpUrl(value.serverUrl?.trim());
                const serverUrlOrigin = serverUrlSafe ? new URL(serverUrlSafe).origin : undefined;
                const fallbackResourceMetadataUrl = server ? null : undefined;
                const resourceMetadataUrl =
                    value.authType.value === 'oauth' && serverUrlOrigin
                        ? `${serverUrlOrigin}/.well-known/oauth-protected-resource`
                        : fallbackResourceMetadataUrl;

                if (
                    value.authType.value === 'basic' &&
                    (value.username.trim() || value.password) &&
                    !(value.username.trim() && value.password)
                ) {
                    setFormError('Enter both username and password to set Basic Authentication credentials.');

                    return;
                }

                const clientCredentialsError =
                    value.authType.value === 'oauth' ? getClientCredentialsError(value, wasManualOauth) : undefined;

                if (clientCredentialsError) {
                    setFormError(clientCredentialsError);

                    return;
                }

                const authCredentials = buildAuthCredentials(value.authType.value, value);

                const payload = {
                    name: value.name.trim(),
                    description: value.description.trim(),
                    serverUrl: value.serverUrl.trim(),
                    authType: value.authType.value,
                    authCredentials,
                    resourceMetadataUrl,
                    ...(shouldSendIsDcr(value.authType.value) && { isDcr: value.isDcr }),
                };

                const saved = server
                    ? ((await updateMutation.mutateAsync({ id: server._id, data: payload })) as McpType)
                    : ((await createMutation.mutateAsync(payload)) as McpType);

                await queryClient.invalidateQueries({ queryKey: ['create-agent', 'picker-groups'] });
                showSuccessToast(server ? 'Connector updated successfully.' : 'Connector created successfully.');
                onSuccess({ _id: saved._id, name: saved.name, description: saved.description });
            } catch (error: unknown) {
                const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
                const message =
                    axiosError.response?.data?.message ||
                    (server ? 'Failed to update connector.' : 'Failed to create connector.');

                setFormError(
                    axiosError.response?.status === 500 ? 'Internal server error, Please try again.' : message,
                );
            }
        },
    });

    const formValues = useStore(form.store, (state) => state.values);

    // Stored credentials belong to the auth type the connector was saved with. Switching type on edit leaves nothing
    // to fall back on, so the newly picked type's fields have to be filled in exactly like a create.
    const credentialsKept = isEditMode && formValues.authType.value === server?.authType;

    const renderHeaderIcon = () => {
        if (isEditMode) {
            return (
                <button
                    type="button"
                    aria-label="Back to connector details"
                    onClick={onBack}
                    className="group flex size-14 shrink-0 cursor-pointer items-center justify-center rounded-[18px] bg-primary text-primary-foreground"
                >
                    <PlugIcon size={22} aria-hidden="true" className="group-hover:hidden" />
                    <ArrowLeftIcon size={22} aria-hidden="true" className="hidden group-hover:block" />
                </button>
            );
        }

        return (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-primary text-primary-foreground">
                <PlugIcon size={22} aria-hidden="true" />
            </div>
        );
    };

    const requiredValidator =
        (message: string) =>
        ({ value }: { value: string }) => {
            if (credentialsKept) return undefined;
            if (!value.trim()) return message;

            return undefined;
        };

    const renderApiKeyFields = () => (
        <>
            <form.Field name="apiKeyHeader">
                {(field) => (
                    <CredentialInput
                        id="connectorApiKeyHeader"
                        label="API Key Header"
                        placeholder={DEFAULT_API_KEY_HEADER}
                        value={field.state.value}
                        errors={field.state.meta.errors}
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                    />
                )}
            </form.Field>
            <form.Field name="apiKey" validators={{ onChange: requiredValidator('API key is required') }}>
                {(field) => (
                    <CredentialInput
                        id="connectorApiKey"
                        label="API Key"
                        placeholder="Enter API key"
                        type="password"
                        required={!credentialsKept}
                        value={field.state.value}
                        errors={field.state.meta.errors}
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                    />
                )}
            </form.Field>
        </>
    );

    const renderBearerFields = () => (
        <form.Field name="token" validators={{ onChange: requiredValidator('Token is required') }}>
            {(field) => (
                <CredentialInput
                    id="connectorToken"
                    label="Token"
                    placeholder="Enter bearer token"
                    type="password"
                    required={!credentialsKept}
                    value={field.state.value}
                    errors={field.state.meta.errors}
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                />
            )}
        </form.Field>
    );

    const renderBasicFields = () => (
        <>
            <form.Field name="username" validators={{ onChange: requiredValidator('Username is required') }}>
                {(field) => (
                    <CredentialInput
                        id="connectorUsername"
                        label="Username"
                        placeholder="Enter username"
                        required={!credentialsKept}
                        value={field.state.value}
                        errors={field.state.meta.errors}
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                    />
                )}
            </form.Field>
            <form.Field name="password" validators={{ onChange: requiredValidator('Password is required') }}>
                {(field) => (
                    <CredentialInput
                        id="connectorPassword"
                        label="Password"
                        placeholder="Enter password"
                        type="password"
                        required={!credentialsKept}
                        value={field.state.value}
                        errors={field.state.meta.errors}
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                    />
                )}
            </form.Field>
        </>
    );

    // Required unless the connector already has a manual client stored, where blank means "keep what is saved".
    const oauthRequiredValidator =
        (message: string) =>
        ({ value }: { value: string }) => {
            if (form.state.values.isDcr || wasManualOauth) return undefined;
            if (!value.trim()) return message;

            return undefined;
        };

    // Dropping back to DCR hides these fields, so their pending values and errors must not linger.
    const resetOauthCredentialFields = () => {
        (['clientId', 'clientSecret'] as const).forEach((name) => {
            form.setFieldValue(name, '');
            form.setFieldMeta(name, (meta) => ({ ...meta, errorMap: {}, errors: [] }));
        });
    };

    // Turning DCR off reveals fields below the fold, so bring them into view instead of leaving them unnoticed.
    const revealCredentialFields = () => {
        requestAnimationFrame(() => {
            credentialsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        });
    };

    const renderDcrToggle = () => (
        <form.Field name="isDcr">
            {(field) => (
                <DcrToggle
                    value={field.state.value}
                    onChange={(value) => {
                        setIsDcrTouched(true);
                        field.handleChange(value);
                        if (value) resetOauthCredentialFields();
                        else revealCredentialFields();
                    }}
                />
            )}
        </form.Field>
    );

    const renderOauthFields = () => (
        <>
            <form.Field name="clientId" validators={{ onChange: oauthRequiredValidator('Client ID is required') }}>
                {(field) => (
                    <CredentialInput
                        id="connectorClientId"
                        label="Client ID"
                        placeholder="Enter client ID"
                        required={!wasManualOauth}
                        value={field.state.value}
                        errors={field.state.meta.errors}
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                    />
                )}
            </form.Field>
            <form.Field
                name="clientSecret"
                validators={{ onChange: oauthRequiredValidator('Client Secret is required') }}
            >
                {(field) => (
                    <CredentialInput
                        id="connectorClientSecret"
                        label="Client Secret"
                        placeholder="Enter client secret"
                        type="password"
                        required={!wasManualOauth}
                        value={field.state.value}
                        errors={field.state.meta.errors}
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                    />
                )}
            </form.Field>
        </>
    );

    const renderCredentialFields = () => {
        if (formValues.authType.value === 'oauth') {
            return renderOauthFields();
        }

        if (formValues.authType.value === 'api-key') {
            return renderApiKeyFields();
        }

        if (formValues.authType.value === 'bearer') {
            return renderBearerFields();
        }

        if (formValues.authType.value === 'basic') {
            return renderBasicFields();
        }

        return null;
    };

    useEffect(() => {
        if (formError) {
            setFormError('');
        }
    }, [formValues]);

    const isPending = createMutation.isPending || updateMutation.isPending;
    const isDcrOauth = formValues.authType.value === 'oauth' && formValues.isDcr;
    const showCredentialFields = CREDENTIAL_AUTH_TYPES.includes(formValues.authType.value) && !isDcrOauth;

    return (
        <div className="flex h-full flex-col">
            <div className="modal-agent-header sticky top-0 z-2 flex h-[80px] items-center gap-3 border-b border-border bg-card px-4 py-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn('sm:hidden', btnCls)}
                    aria-label="Back"
                    onClick={onBack}
                >
                    <ArrowLeftIcon size={17} aria-hidden="true" />
                </Button>
                {renderHeaderIcon()}
                <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="truncate text-lg font-medium tracking-[-0.03em] text-(--text-primary)">
                        {formValues.name.trim() || (isEditMode ? 'Edit connector' : 'Create a connector')}
                    </h3>
                    <span className="truncate text-sm text-text-secondary">
                        {isEditMode ? 'Update your MCP connector' : 'Add a new MCP connector'}
                    </span>
                </div>
                <Button variant="ghost" size="icon" className={btnCls} aria-label="Close" onClick={onClose}>
                    <XIcon size={17} aria-hidden="true" />
                </Button>
            </div>

            <div className="modal-agent-content scrollbar-controller scrollbar-vertical flex-1 px-4 py-6">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void form.handleSubmit();
                    }}
                    className={cn('flex flex-col gap-5', pickerFormWrapCls)}
                >
                    <form.Field
                        name="name"
                        validators={{ onChange: ({ value }) => (!value.trim() ? 'Name is required' : undefined) }}
                    >
                        {(field) => (
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="connectorName" className="text-sm font-medium text-text-secondary">
                                    Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="connectorName"
                                    placeholder="GitHub"
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    className="h-10 bg-card"
                                />
                                {field.state.meta.errors.length > 0 ? (
                                    <span className="text-xs text-destructive">
                                        {field.state.meta.errors.join(', ')}
                                    </span>
                                ) : null}
                            </div>
                        )}
                    </form.Field>

                    <form.Field
                        name="serverUrl"
                        validators={{
                            onChange: ({ value }) => (!value.trim() ? 'Server URL is required' : undefined),
                            onBlur: ({ value }) => (value && !getSafeHttpUrl(value) ? 'Invalid server URL' : undefined),
                        }}
                    >
                        {(field) => (
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="connectorServerUrl" className="text-sm font-medium text-text-secondary">
                                    Server URL <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="connectorServerUrl"
                                    placeholder="https://example.com/mcp"
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    className="h-10 bg-card"
                                />
                                {field.state.meta.errors.length > 0 ? (
                                    <span className="text-xs text-destructive">
                                        {field.state.meta.errors.join(', ')}
                                    </span>
                                ) : null}
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="description">
                        {(field) => (
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-sm font-medium text-text-secondary">Description</Label>
                                <TextAreaForm
                                    name={field.name}
                                    className="max-h-[100px] min-h-[60px]"
                                    placeholder="Briefly describe what this connector does."
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(val) => field.handleChange(val)}
                                />
                            </div>
                        )}
                    </form.Field>

                    <form.Field
                        name="authType"
                        validators={{ onChange: ({ value }) => (!value ? 'Auth Type is required' : undefined) }}
                    >
                        {(field) => (
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-sm font-medium text-text-secondary">
                                    Auth Type <span className="text-destructive">*</span>
                                </Label>
                                <Select<string>
                                    variant="ghost"
                                    placeholder="Select"
                                    options={AUTH_TYPE_OPTIONS}
                                    className="h-10 bg-card"
                                    value={field.state.value?.value ?? null}
                                    onChange={(val) => {
                                        if (val == null) return;
                                        const option = AUTH_TYPE_OPTIONS.find((o) => o.value === val);

                                        field.handleChange({ value: val, label: option?.label ?? val });
                                        field.handleBlur();
                                    }}
                                />
                            </div>
                        )}
                    </form.Field>

                    {formValues.authType.value === 'oauth' && renderDcrToggle()}

                    {showCredentialFields && (
                        <div ref={credentialsRef} className="flex scroll-mb-4 flex-col gap-1.5">
                            <Label className="text-sm font-medium text-text-secondary">Auth Credentials</Label>
                            {credentialsKept && (
                                <span className="text-xs text-text-secondary">
                                    Existing credentials are kept unless you enter new values here.
                                </span>
                            )}
                            <div className="flex flex-col gap-4">{renderCredentialFields()}</div>
                        </div>
                    )}
                </form>

                {formError && (
                    <div className={cn('py-2', pickerFormWrapCls)}>
                        <span className="text-sm font-medium text-destructive">{formError}</span>
                    </div>
                )}
            </div>

            <div className="modal-agent-footer sticky bottom-0 z-1 mt-auto border-t border-border bg-card p-4">
                <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                    {([canSubmit, isSubmitting]) => (
                        <div className={pickerFormWrapCls}>
                            <Button
                                className="h-12 w-full justify-center rounded-2xl text-sm font-semibold"
                                disabled={!canSubmit || isSubmitting || isPending}
                                onClick={() => void form.handleSubmit()}
                            >
                                {renderSubmitLabel(isEditMode, !!isSubmitting || isPending)}
                            </Button>
                        </div>
                    )}
                </form.Subscribe>
            </div>
        </div>
    );
};
