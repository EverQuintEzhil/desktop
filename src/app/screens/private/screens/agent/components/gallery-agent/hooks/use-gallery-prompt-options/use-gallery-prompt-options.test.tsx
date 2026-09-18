import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UploadFilesProvider } from '@/context';
import { installDataTransferShim } from '@/test/dom-shims';
import { renderWithProviders } from '@/test/test-utils';
import type { GalleryAgentType, ModelValueType, ParameterType } from '@/types/admin';

import useGalleryPromptOptions from './use-gallery-prompt-options';

installDataTransferShim();

type Api = ReturnType<typeof useGalleryPromptOptions>;

let api: Api;

interface ProbeProps {
    agent: GalleryAgentType;
    initialPrompt?: string;
    initialIsPublic?: boolean;
}

const Probe = (props: ProbeProps) => {
    api = useGalleryPromptOptions(props);

    return <div>{api.renderSelectedParameters()}</div>;
};

const STORAGE_KEY = 'gallery-agent-params:user-1:agent-1';

const sizeParameter: ParameterType = {
    label: 'Size',
    type: 'select',
    showDefault: true,
    default: { label: 'Square', value: 'square' },
    options: [
        { label: 'Square', value: 'square' },
        { label: 'Portrait', value: 'portrait' },
    ],
};

const countParameter: ParameterType = {
    label: 'Count',
    type: 'range',
    default: 2,
    range: { min: 1, max: 4, step: 1 },
};

const model = (overrides: Partial<ModelValueType> = {}): ModelValueType => ({
    name: 'Imagen',
    modelId: 'model-1',
    ...overrides,
});

const makeAgent = (uiConfig: Record<string, unknown> = {}): GalleryAgentType =>
    ({
        _id: 'agent-1',
        slug: 'gallery-agent',
        uiConfig: {
            models: [model()],
            ...uiConfig,
        },
    }) as unknown as GalleryAgentType;

const renderOptions = (agent: GalleryAgentType = makeAgent(), props: Omit<ProbeProps, 'agent'> = {}) =>
    renderWithProviders(
        <UploadFilesProvider>
            <Toaster />
            <Probe agent={agent} {...props} />
        </UploadFilesProvider>,
        { preloadedState: { user: { _id: 'user-1', isAuthenticated: true } } },
    );

const readStored = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');

describe('useGalleryPromptOptions', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    afterEach(() => {
        window.localStorage.clear();
    });

    it('selects the first available model when the agent names no default', () => {
        renderOptions(makeAgent({ models: [model(), model({ name: 'Flux', modelId: 'model-2' })] }));

        expect(api.availableModels.map((entry) => entry.label)).toEqual(['Imagen', 'Flux']);
        expect(api.selectedModel?.value.modelId).toBe('model-1');
    });

    it('resolves the configured default model out of the list', () => {
        renderOptions(
            makeAgent({
                models: [model(), model({ name: 'Flux', modelId: 'model-2' })],
                defaultModel: model({ name: 'Flux', modelId: 'model-2' }),
            }),
        );

        expect(api.selectedModel?.label).toBe('Flux');
    });

    it('keeps a default model that is missing from the list', () => {
        renderOptions(
            makeAgent({
                models: [model()],
                defaultModel: model({ name: 'Retired', modelId: 'model-9' }),
            }),
        );

        expect(api.selectedModel?.value.modelId).toBe('model-9');
        expect(api.availableModels).toHaveLength(1);
    });

    it('seeds the parameters that ask to be shown by default', () => {
        renderOptions(makeAgent({ parameters: { size: sizeParameter, count: countParameter } }));

        expect(api.parameters.size).toEqual({ label: 'Square', value: 'square' });
        expect(api.parameters.count).toBeUndefined();
    });

    it('follows the agent config for the public flag and the toggle', () => {
        renderOptions(makeAgent({ isPublic: true, showPublicPrivateToggle: true }));

        expect(api.isPublic).toBe(true);
        expect(api.showPublicPrivateToggle).toBe(true);
    });

    it('lets the caller override the agent public flag', () => {
        renderOptions(makeAgent({ isPublic: true }), { initialIsPublic: false });

        expect(api.isPublic).toBe(false);
        expect(api.showPublicPrivateToggle).toBe(false);
    });

    it('carries the initial prompt into the query', () => {
        renderOptions(makeAgent(), { initialPrompt: 'a cat on a bicycle' });

        expect(api.query).toBe('a cat on a bicycle');
    });

    it('offers only the parameters that are not already applied', () => {
        renderOptions(makeAgent({ parameters: { size: sizeParameter, count: countParameter } }));

        expect(api.plusDropdownOptions.map((option) => option.value)).toEqual(['count']);
    });

    it('lets a model parameter replace the agent parameter of the same key', () => {
        renderOptions(
            makeAgent({
                parameters: { count: countParameter },
                models: [model({ parameters: { count: { ...countParameter, label: 'Model count' } } })],
            }),
        );

        expect(api.plusDropdownOptions).toHaveLength(1);
        expect(api.plusDropdownOptions[0].label).toBe('Model count');
    });

    it('applies a parameter default when its plus option is chosen, then drops it from the list', () => {
        renderOptions(makeAgent({ parameters: { count: countParameter } }));

        act(() => {
            api.handlePlusDropdownSelect(api.plusDropdownOptions[0]);
        });

        expect(api.parameters.count).toBe(2);
        expect(api.plusDropdownOptions).toHaveLength(0);
    });

    it('puts a removed parameter back on the plus menu', async () => {
        const user = userEvent.setup();

        renderOptions(makeAgent({ parameters: { size: sizeParameter } }));

        expect(api.plusDropdownOptions).toHaveLength(0);

        await user.click(
            within(screen.getByRole('group', { name: 'Size' })).getByRole('button', { name: 'Remove Size' }),
        );

        expect(api.parameters.size).toBeUndefined();
        expect(api.plusDropdownOptions.map((option) => option.value)).toEqual(['size']);
    });

    it('renders a control for a range parameter once it is applied', () => {
        renderOptions(makeAgent({ parameters: { count: countParameter } }));

        expect(screen.queryByText('2')).toBeNull();

        act(() => {
            api.handlePlusDropdownSelect(api.plusDropdownOptions[0]);
        });

        expect(screen.getByText('2')).toBeInTheDocument();
        // The range chip is a named group, and its remove affordance says what it removes.
        expect(
            within(screen.getByRole('group', { name: 'Count' })).getByRole('button', { name: 'Remove Count' }),
        ).toBeInTheDocument();
    });

    it('opens the file picker from the add-photo option', () => {
        renderOptions();

        const click = vi.fn();
        const option = api.getAddPhotoOption({ current: { click } as unknown as HTMLInputElement });

        expect(option.value).toBe('add-photo');
        expect(option.label).toBe('Add photo');

        option.onClick();

        expect(click).toHaveBeenCalledTimes(1);
    });

    it('switches model and maps the supplied defaults onto its parameters', () => {
        renderOptions(
            makeAgent({
                models: [
                    model(),
                    model({
                        name: 'Flux',
                        modelId: 'model-2',
                        parameters: { size: sizeParameter, count: countParameter },
                    }),
                ],
            }),
        );

        act(() => {
            api.setDefaultParameters({ size: 'portrait', count: 3 }, 'model-2');
        });

        expect(api.selectedModel?.value.modelId).toBe('model-2');
        expect(api.parameters.size).toEqual({ label: 'Portrait', value: 'portrait' });
        expect(api.parameters.count).toBe(3);
    });

    it('ignores an empty set of defaults', () => {
        renderOptions(makeAgent({ parameters: { size: sizeParameter } }));

        act(() => {
            api.setDefaultParameters(null, 'model-2');
        });

        expect(api.parameters.size).toEqual({ label: 'Square', value: 'square' });
    });

    it('keeps the current model and only the surviving values when the model is unknown', () => {
        renderOptions(makeAgent({ parameters: { count: countParameter, size: sizeParameter } }));

        act(() => {
            api.setDefaultParameters({ count: 99, size: 'nonexistent' }, 'model-missing');
        });

        expect(api.selectedModel?.value.modelId).toBe('model-1');
        expect(api.parameters.count).toBe(4);
        expect(api.parameters.size).toBeUndefined();
    });

    it('changes nothing when no supplied default survives the current model', () => {
        renderOptions(makeAgent({ parameters: { size: sizeParameter } }));

        act(() => {
            api.setDefaultParameters({ unknownKey: 'x' }, 'model-missing');
        });

        expect(api.parameters.size).toEqual({ label: 'Square', value: 'square' });
    });

    it('restores the pre-remix snapshot', () => {
        renderOptions(
            makeAgent({
                models: [model(), model({ name: 'Flux', modelId: 'model-2', parameters: { count: countParameter } })],
                parameters: { size: sizeParameter },
            }),
        );

        act(() => {
            api.setDefaultParameters({ count: 3 }, 'model-2');
        });
        expect(api.selectedModel?.value.modelId).toBe('model-2');

        act(() => {
            api.resetDefaultParameters();
        });

        expect(api.selectedModel?.value.modelId).toBe('model-1');
        expect(api.parameters.size).toEqual({ label: 'Square', value: 'square' });
        expect(api.parameters.count).toBeUndefined();
    });

    it('does nothing on reset when no snapshot was taken', () => {
        renderOptions(makeAgent({ parameters: { size: sizeParameter } }));

        act(() => {
            api.resetDefaultParameters();
        });

        expect(api.parameters.size).toEqual({ label: 'Square', value: 'square' });
    });

    it('reconciles the parameters when the user switches model', () => {
        renderOptions(
            makeAgent({
                models: [
                    model({ parameters: { count: countParameter } }),
                    model({
                        name: 'Flux',
                        modelId: 'model-2',
                        parameters: {
                            count: {
                                label: 'Count',
                                type: 'range',
                                default: 1,
                                range: { min: 1, max: 2, step: 1 },
                            },
                            size: sizeParameter,
                        },
                    }),
                ],
            }),
        );

        act(() => {
            api.handlePlusDropdownSelect(api.plusDropdownOptions.find((option) => option.value === 'count')!);
        });
        expect(api.parameters.count).toBe(2);

        act(() => {
            api.setSelectedModel(api.availableModels[1]);
        });

        expect(api.parameters.count).toBe(2);
        expect(api.parameters.size).toEqual({ label: 'Square', value: 'square' });
    });

    it('drops a parameter the newly selected model does not know about', () => {
        renderOptions(
            makeAgent({
                models: [model({ parameters: { count: countParameter } }), model({ name: 'Flux', modelId: 'model-2' })],
            }),
        );

        act(() => {
            api.handlePlusDropdownSelect(api.plusDropdownOptions[0]);
        });
        expect(api.parameters.count).toBe(2);

        act(() => {
            api.setSelectedModel(api.availableModels[1]);
        });

        expect(api.parameters.count).toBeUndefined();
    });

    it('keeps the composer on one line for a single model and no parameters', () => {
        renderOptions(makeAgent());

        expect(api.isNextLine).toBe(false);
    });

    it('needs a second composer line once more than one model is offered', () => {
        renderOptions(makeAgent({ models: [model(), model({ name: 'Flux', modelId: 'model-2' })] }));

        expect(api.isNextLine).toBe(true);
    });

    it('persists the selected model and parameters for this user and agent', async () => {
        renderOptions(
            makeAgent({
                models: [model(), model({ name: 'Flux', modelId: 'model-2' })],
                parameters: { size: sizeParameter },
            }),
        );

        act(() => {
            api.setSelectedModel(api.availableModels[1]);
        });

        expect(readStored()).toEqual({
            modelId: 'model-2',
            parameters: { size: 'square' },
            knownKeys: ['size'],
        });
    });

    it('restores a persisted model and parameter set on mount', () => {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                modelId: 'model-2',
                parameters: { size: 'portrait' },
                knownKeys: ['size'],
            }),
        );

        renderOptions(
            makeAgent({
                models: [model(), model({ name: 'Flux', modelId: 'model-2' })],
                parameters: { size: sizeParameter },
            }),
        );

        expect(api.selectedModel?.value.modelId).toBe('model-2');
        expect(api.parameters.size).toEqual({ label: 'Portrait', value: 'portrait' });
    });

    it('ignores an unparseable persisted record', () => {
        window.localStorage.setItem(STORAGE_KEY, 'not json');

        renderOptions(makeAgent({ parameters: { size: sizeParameter } }));

        expect(api.selectedModel?.value.modelId).toBe('model-1');
        expect(api.parameters.size).toEqual({ label: 'Square', value: 'square' });
    });

    it('adopts a record written by another tab', () => {
        renderOptions(
            makeAgent({
                models: [model(), model({ name: 'Flux', modelId: 'model-2' })],
                parameters: { size: sizeParameter },
            }),
        );

        act(() => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: STORAGE_KEY,
                    newValue: JSON.stringify({
                        modelId: 'model-2',
                        parameters: { size: 'portrait' },
                        knownKeys: ['size'],
                    }),
                }),
            );
        });

        expect(api.selectedModel?.value.modelId).toBe('model-2');
        expect(api.parameters.size).toEqual({ label: 'Portrait', value: 'portrait' });
    });

    it('ignores a storage event for a different key', () => {
        renderOptions(
            makeAgent({
                models: [model(), model({ name: 'Flux', modelId: 'model-2' })],
            }),
        );

        act(() => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'gallery-agent-params:user-1:other-agent',
                    newValue: JSON.stringify({ modelId: 'model-2', parameters: {}, knownKeys: [] }),
                }),
            );
        });

        expect(api.selectedModel?.value.modelId).toBe('model-1');
    });

    it('rejects a file whose type the picker does not accept', async () => {
        renderOptions();

        act(() => {
            api.onChangeFile({
                target: {
                    accept: 'image/*',
                    multiple: true,
                    value: 'C:\\fakepath\\notes.txt',
                    files: [new File(['x'], 'notes.txt', { type: 'text/plain' })],
                },
            } as unknown as React.ChangeEvent<HTMLInputElement>);
        });

        expect(
            await screen.findByText('Upload failed: notes.txt is an invalid format. Only images are permitted.'),
        ).toBeInTheDocument();
    });

    it('ignores a change event that carries no files at all', () => {
        renderOptions();

        act(() => {
            api.onChangeFile({ target: {} } as unknown as React.ChangeEvent<HTMLInputElement>);
        });

        expect(screen.queryByText(/Upload failed/)).toBeNull();
    });
});
