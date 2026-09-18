export type ConnectionProviderOption = { label?: string; config: Record<string, unknown> };

type ConnectionFieldDescriptor = {
    type: string;
    required: boolean;
    otherFieldsShouldComplete?: boolean;
    derivedFromUrl?: boolean;
    sensitive?: boolean;
};

const isConnectionFieldDescriptor = (val: unknown): val is ConnectionFieldDescriptor =>
    val !== null &&
    typeof val === 'object' &&
    !Array.isArray(val) &&
    'type' in val &&
    typeof (val as Record<string, unknown>).type === 'string' &&
    ['string', 'number', 'boolean', 'json', 'url', 'object', 'array', 'select'].includes(
        (val as Record<string, unknown>).type as string,
    ) &&
    'required' in val &&
    typeof (val as Record<string, unknown>).required === 'boolean';

const CONNECTION_FIELD_LABELS: Record<string, string> = {
    ssl: 'SSL',
    url: 'URL',
    baseUrl: 'Base URL',
    apiKey: 'API Key',
    cloudId: 'Cloud ID',
    trustServerCertificate: 'Trust Server Certificate',
    authSource: 'Auth Source',
    headerName: 'Header Name',
    connectionString: 'Connection String',
    containerName: 'Container Name',
    accountKey: 'Account Key',
    accountName: 'Account Name',
    endpointSuffix: 'Endpoint Suffix',
    accessKeyId: 'Access Key ID',
    secretAccessKey: 'Secret Access Key',
    forcePathStyle: 'Force Path Style',
    contactPoints: 'Contact Points',
};

export const connectionToLabel = (path: string): string => {
    const key = path.split('.').pop() ?? path;

    return CONNECTION_FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
};

export const connectionGetOptionLabel = (option: ConnectionProviderOption, index: number): string => {
    if (option.label) {
        return option.label.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    }

    return `Option ${index + 1}`;
};

export type ConnectionFieldLeaf = {
    path: string;
    value: unknown;
    required: boolean;
    otherFieldsShouldComplete?: boolean;
    derivedFromUrl?: boolean;
    sensitive?: boolean;
};

export const connectionFlattenToLeaves = (obj: Record<string, unknown>, prefix = ''): ConnectionFieldLeaf[] => {
    const result: ConnectionFieldLeaf[] = [];

    for (const [key, val] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;

        if (isConnectionFieldDescriptor(val)) {
            const d = val as ConnectionFieldDescriptor;

            result.push({
                path,
                value: d.type,
                required: d.required,
                otherFieldsShouldComplete: d.otherFieldsShouldComplete,
                ...(d.derivedFromUrl ? { derivedFromUrl: true as const } : {}),
                ...(d.sensitive ? { sensitive: true as const } : {}),
            });
        } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
            result.push(...connectionFlattenToLeaves(val as Record<string, unknown>, path));
        } else {
            result.push({ path, value: val, required: false });
        }
    }

    return result;
};

export const connectionBuildNestedInitialValues = (fields: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(fields)) {
        if (isConnectionFieldDescriptor(val)) {
            result[key] = '';
        } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
            result[key] = connectionBuildNestedInitialValues(val as Record<string, unknown>);
        } else {
            result[key] = '';
        }
    }

    return result;
};

export const connectionCoerceNestedValues = (
    obj: Record<string, unknown>,
    schema: Record<string, unknown>,
): Record<string, unknown> => {
    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(obj)) {
        const schemaVal = schema[key];
        const descriptor = isConnectionFieldDescriptor(schemaVal) ? schemaVal : null;
        const schemaType = descriptor ? descriptor.type : null;

        if (
            !descriptor &&
            schemaVal !== null &&
            typeof schemaVal === 'object' &&
            !Array.isArray(schemaVal) &&
            val !== null &&
            typeof val === 'object' &&
            !Array.isArray(val)
        ) {
            result[key] = connectionCoerceNestedValues(
                val as Record<string, unknown>,
                schemaVal as Record<string, unknown>,
            );
        } else if (schemaType === 'boolean') {
            result[key] = val === 'true';
        } else if (schemaType === 'number') {
            result[key] = val === '' ? null : Number(val);
        } else if (schemaType === 'json' || schemaType === 'object' || schemaType === 'array') {
            try {
                result[key] = val && typeof val === 'string' && val.trim() !== '' ? JSON.parse(val) : null;
            } catch {
                result[key] = null;
            }
        } else {
            result[key] = val;
        }
    }

    return result;
};

export const connectionGetValueType = (value: unknown): 'boolean' | 'number' | 'text' | 'json' | 'select' => {
    if (value === 'boolean') return 'boolean';
    if (value === 'number') return 'number';
    if (value === 'json' || value === 'object' || value === 'array') return 'json';
    if (value === 'select') return 'select';

    return 'text';
};

export const connectionGetNestedValue = (obj: Record<string, unknown>, path: string): unknown =>
    path.split('.').reduce<unknown>((acc, key) => {
        if (acc !== null && typeof acc === 'object') {
            return (acc as Record<string, unknown>)[key];
        }

        return undefined;
    }, obj);

/** Prefer errorMap over meta.errors: useField keeps errorMap reactive but can leave errors[] stale. */
export const connectionFirstFieldErrorFromErrorMap = (
    errorMap: Record<string, unknown> | undefined,
): string | undefined => {
    const flat = Object.values(errorMap ?? {})
        .flatMap((v) => {
            if (Array.isArray(v)) return v;
            if (v != null) return [v];

            return [];
        })
        .filter((v): v is string => typeof v === 'string');

    return flat[0];
};

/** True when the connection URL string includes "https" (case-insensitive). */
export const connectionDeriveSslFromUrl = (url: unknown): boolean =>
    String(url ?? '')
        .toLowerCase()
        .includes('https');

/** Sibling `url` field path for an `ssl` field that uses {@link connectionDeriveSslFromUrl}. */
export const connectionUrlPathForSslDerivedFromUrl = (sslFieldPath: string): string => {
    const parts = sslFieldPath.split('.');
    const last = parts.pop();

    if (last === 'ssl') {
        parts.push('url');

        return parts.join('.');
    }

    return 'url';
};
