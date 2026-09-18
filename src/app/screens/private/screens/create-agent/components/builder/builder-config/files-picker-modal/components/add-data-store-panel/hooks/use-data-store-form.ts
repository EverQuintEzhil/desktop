import { useForm } from '@tanstack/react-form';

import type { DataStoreFormValues } from '../types';

/**
 * Thin wrapper around `useForm` so its return type can be named (`DataStoreForm` below) and
 * passed down to ConnectionFieldsSection without widening to `any`/`AnyFormApi` — Tanstack
 * Form's generics are tied to the exact call site, so re-declaring the type by hand drifts out
 * of sync with whatever `onSubmit`/validators AddDataStorePanel passes in.
 */
export const useDataStoreForm = (options: {
    defaultValues: DataStoreFormValues;
    onSubmit: (args: { value: DataStoreFormValues }) => Promise<void>;
}) => useForm(options);

export type DataStoreForm = ReturnType<typeof useDataStoreForm>;
