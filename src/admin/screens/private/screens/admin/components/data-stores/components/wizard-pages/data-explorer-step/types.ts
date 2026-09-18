import type { WizardFormPageProps } from '@/admin/components/wizard';

/** Props this step actually uses; omit all when embedding outside `WizardForm`. */
export type DataExplorerStepProps = Partial<
    Pick<WizardFormPageProps, 'setCanGoNext' | 'commonData' | 'handleCommonDataChange'>
> & {
    isWizardPage?: boolean;
};

/** Per-field query strings keyed by `explorerQueryTypes` field `label` (e.g. filter, query, args). */
export type DataExplorerPayload = Record<string, string>;

export type ExplorerFieldType = 'single-line-json' | 'single-line-text' | 'full-json';

export type ExplorerViewMode = 'normal' | 'split';

export type ExplorerMethod = 'find' | 'query' | 'aggregate' | null;

export type ExplorerFieldDef = {
    label: string;
    type: ExplorerFieldType;
    placeholder: string;
    /** When true (with `method: null`), merge parsed JSON into the POST body root instead of a named field. */
    iterateFullBody?: boolean;
    /** When true, use the value nested under this field label as the request body. */
    sendThisValueInBody?: boolean;
    /** When true, explore may return `value.request[label]`; the UI seeds that field from the response. */
    default?: boolean;
    /** When true, seed this field from the entire `request` echo object rather than `request[label]`. */
    takeFullResponse?: boolean;
};

export type ExplorerConfig = {
    method: ExplorerMethod;
    fields: ExplorerFieldDef[];
    view: ExplorerViewMode;
};

/** Row shape for explorer (dynamic keys from documents) */
export type DocumentRow = Record<string, unknown> & { _id: string };
