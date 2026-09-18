import { Checkbox } from '@/components/ui/checkbox';
import FormField from '@/components/ui/form-field';
import { Label } from '@/components/ui/label';

import type { PromptFormApi } from '../types';

export interface Props {
    form: PromptFormApi;
}

const PromptVisibilitySettings = (props: Props) => {
    const { form } = props;

    return (
        <div className="flex flex-col gap-2">
            <Label className="text-sm">Visibility</Label>
            <div className="flex flex-wrap gap-6 rounded-xl border border-border-secondary bg-card p-4">
                <form.Field
                    name="isPublished"
                    children={(field) => (
                        <FormField label="" field={field}>
                            {() => (
                                <Checkbox
                                    label="Published"
                                    name={field.name}
                                    onBlur={field.handleBlur}
                                    checked={field.state.value}
                                    onChange={(_, val) => {
                                        field.handleChange(val);
                                    }}
                                />
                            )}
                        </FormField>
                    )}
                />
                <form.Field
                    name="isPrivate"
                    children={(field) => (
                        <FormField label="" field={field}>
                            {() => (
                                <Checkbox
                                    label="Private"
                                    name={field.name}
                                    onBlur={field.handleBlur}
                                    checked={field.state.value}
                                    onChange={(_, val) => {
                                        field.handleChange(val);
                                    }}
                                />
                            )}
                        </FormField>
                    )}
                />
            </div>
        </div>
    );
};

export default PromptVisibilitySettings;
