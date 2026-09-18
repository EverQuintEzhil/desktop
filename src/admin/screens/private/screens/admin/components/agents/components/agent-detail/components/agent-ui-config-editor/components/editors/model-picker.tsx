import { useEffect, useState } from 'react';
import type { z } from 'zod';

import Select from '@/components/ui/select';
import { modelDisplayName } from '@/types/admin';

import { fetchModelsByIds, fetchModelsSuggestion, type ModelSuggestion } from '../../hooks/use-models-suggestion';
import type { uiConfigSchema } from '../../schema';
import FieldErrorMessage from '../primitives/field-error-message';
import FieldHelp from '../primitives/field-help';

type ModelValueShape = NonNullable<Extract<z.infer<typeof uiConfigSchema>, { componentType: 'chat' }>['defaultModel']>;

interface Props {
    label: string;
    description?: string;
    value: ModelValueShape | undefined;
    onChange: (next: ModelValueShape | undefined) => void;
    availableModels?: ModelValueShape[];
    disabled?: boolean;
    required?: boolean;
    error?: string;
}

const ModelPicker = ({ label, description, value, onChange, availableModels, disabled, required, error }: Props) => {
    const [asyncModelMetaById, setAsyncModelMetaById] = useState<Record<string, { label: string; name: string }>>({});
    const valueModelId = value?.modelId || null;
    const resolvedAsyncModelMeta = valueModelId ? asyncModelMetaById[valueModelId] : undefined;
    const asyncDefaultOption =
        value && !availableModels
            ? {
                  value: value.modelId,
                  label: resolvedAsyncModelMeta?.label || value.name || value.modelId,
              }
            : undefined;

    useEffect(() => {
        if (availableModels) {
            return;
        }

        if (!value?.modelId) {
            return;
        }

        if (resolvedAsyncModelMeta) {
            return;
        }

        let isCancelled = false;

        const resolveLabel = async () => {
            try {
                const [model] = await fetchModelsByIds([value.modelId]);

                if (!isCancelled) {
                    setAsyncModelMetaById((prev) => ({
                        ...prev,
                        [value.modelId]: {
                            label: model ? `${modelDisplayName(model)} (${model.provider})` : value.modelId,
                            name: modelDisplayName(model) || value.name || value.modelId,
                        },
                    }));
                }
            } catch {
                if (!isCancelled) {
                    setAsyncModelMetaById((prev) => ({
                        ...prev,
                        [value.modelId]: {
                            label: value.modelId,
                            name: value.name || value.modelId,
                        },
                    }));
                }
            }
        };

        resolveLabel();

        return () => {
            isCancelled = true;
        };
    }, [availableModels, resolvedAsyncModelMeta, value?.modelId, value?.name]);

    const renderLocalSelect = () => {
        const options = (availableModels ?? [])
            .filter((m) => m.modelId)
            .map((m) => ({ value: m, label: m.name || m.modelId }));

        return (
            <Select<ModelValueShape>
                variant="outline"
                className="rounded-md"
                placeholder="Select model…"
                allowDeselect={!required}
                disabled={disabled}
                isErrored={Boolean(error)}
                value={value ?? null}
                options={options}
                onChange={(next) => onChange(next ?? undefined)}
            />
        );
    };

    const renderAsyncSelect = () => (
        <Select<string>
            variant="outline"
            className="rounded-md"
            placeholder="Search models…"
            allowSearch
            allowDeselect={!required}
            disabled={disabled}
            isErrored={Boolean(error)}
            value={valueModelId}
            defaultOption={asyncDefaultOption}
            options={async (query: string) => {
                const items = await fetchModelsSuggestion(query);

                setAsyncModelMetaById((prev) => ({
                    ...prev,
                    ...Object.fromEntries(
                        items.map((item) => [item.modelId, { label: item.label, name: item.modelName }]),
                    ),
                }));

                return items.map((i: ModelSuggestion) => ({
                    value: i.modelId,
                    label: i.label,
                }));
            }}
            onChange={(nextModelId) => {
                if (!nextModelId) {
                    onChange(undefined);

                    return;
                }
                const asyncModelMeta = asyncModelMetaById[nextModelId];

                onChange({
                    modelId: nextModelId,
                    name: asyncModelMeta?.name || nextModelId,
                });
            }}
        />
    );

    return (
        <div className="flex flex-col gap-1.5">
            <FieldHelp label={label} description={description} required={required} />
            {availableModels ? renderLocalSelect() : renderAsyncSelect()}
            <FieldErrorMessage error={error} />
        </div>
    );
};

export default ModelPicker;
