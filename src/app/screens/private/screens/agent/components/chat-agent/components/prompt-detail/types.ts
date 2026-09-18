import type { ReactFormExtendedApi } from '@tanstack/react-form';

export interface PromptFormValues {
    name: string;
    description: string;
    prompt: string;
    isPrivate: boolean;
    isPublished: boolean;
}

/**
 * `useForm`'s remaining validator-shape generics are left as `any` (matching the
 * pattern used for `dynamicForm`/`MemoryFormApi` elsewhere in the repo) since
 * PromptDetail's `useForm` call only sets `defaultValues` and `onSubmit`. Pinning
 * `TFormData` to `PromptFormValues` keeps `form.Field` names typed for every
 * extracted field-set component.
 */
// with the AnyFieldApi that FormField requires; any is the library-sanctioned escape here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PromptFormApi = ReactFormExtendedApi<
    PromptFormValues,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any
>;
