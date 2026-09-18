export type WizardCommonData = {
    dataStore?: { provider?: string; _id?: string };
    /** When true, the cron step is shown. Undefined until the user answers the cron confirmation modal. */
    dontSkipCron?: boolean;
    /** When false, the embedding / files-folders step is omitted. Undefined or true includes it. */
    dontSkipEmbeddingFields?: boolean;
    requestEmbeddingFieldsChoice?: () => void;
    requestCronChoice?: () => void;
} | null;
