import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const DEFAULT_API_KEY_HEADER = 'x-api-key';

export interface CredentialFormValues {
    apiKeyHeader: string;
    apiKey: string;
    token: string;
    username: string;
    password: string;
    isDcr: boolean;
    clientId: string;
    clientSecret: string;
}

export const CLIENT_CREDENTIALS_MESSAGE = 'Enter both Client ID and Client Secret to set OAuth credentials.';

type ClientCredentialValues = Pick<CredentialFormValues, 'isDcr' | 'clientId' | 'clientSecret'>;

/**
 * With DCR off the connector needs a client pair. Only a connector already saved as manual has one
 * stored server-side, so every other case must be given both halves here.
 */
export const getClientCredentialsError = (
    value: ClientCredentialValues,
    wasManualOauth: boolean,
): string | undefined => {
    if (value.isDcr) return undefined;

    const hasClientId = !!value.clientId.trim();
    const hasClientSecret = !!value.clientSecret.trim();

    if (!wasManualOauth && !(hasClientId && hasClientSecret)) return CLIENT_CREDENTIALS_MESSAGE;
    if (hasClientId !== hasClientSecret) return CLIENT_CREDENTIALS_MESSAGE;

    return undefined;
};

export const buildAuthCredentials = (
    authType: string,
    value: CredentialFormValues,
): Record<string, string> | undefined => {
    if (authType === 'oauth') {
        // With dynamic client registration the server issues the client itself, so there is nothing to send.
        if (value.isDcr) return undefined;
        if (!value.clientId.trim() || !value.clientSecret.trim()) return undefined;

        return {
            client_id: value.clientId.trim(),
            client_secret: value.clientSecret.trim(),
        };
    }

    if (authType === 'api-key') {
        if (!value.apiKey.trim()) return undefined;

        return {
            apiKeyHeader: value.apiKeyHeader.trim() || DEFAULT_API_KEY_HEADER,
            apiKey: value.apiKey.trim(),
        };
    }

    if (authType === 'bearer') {
        if (!value.token.trim()) return undefined;

        return { token: value.token.trim() };
    }

    if (authType === 'basic') {
        if (!value.username.trim() || !value.password) return undefined;

        return {
            username: value.username.trim(),
            password: value.password,
        };
    }

    return undefined;
};

interface CredentialInputProps {
    id: string;
    label: string;
    placeholder: string;
    type?: 'text' | 'password';
    required?: boolean;
    value: string;
    errors: unknown[];
    onBlur: () => void;
    onChange: (value: string) => void;
}

const renderRequiredMark = (required: boolean) => {
    if (!required) return null;

    return (
        <>
            {' '}
            <span className="text-destructive">*</span>
        </>
    );
};

export const CredentialInput = ({
    id,
    label,
    placeholder,
    type = 'text',
    required = false,
    value,
    errors,
    onBlur,
    onChange,
}: CredentialInputProps) => (
    <div className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-sm font-medium text-text-secondary">
            {label}
            {renderRequiredMark(required)}
        </Label>
        <Input
            id={id}
            type={type}
            placeholder={placeholder}
            value={value}
            onBlur={onBlur}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 bg-card"
        />
        {errors.length > 0 ? <span className="text-xs text-destructive">{errors.join(', ')}</span> : null}
    </div>
);
