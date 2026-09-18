import { HomeIcon } from 'lucide-react';

import { CheckboxShadcn } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import TextAreaForm from '@/components/ui/textarea-form';
import type { AppType, ToolType } from '@/types/admin';

import FileTypeSelector from '../components/editors/file-type-selector';
import JsonSnippetEditor from '../components/editors/json-snippet-editor';
import StringListEditor from '../components/editors/string-list-editor';
import AccordionSection from '../components/primitives/accordion-section';
import FieldErrorMessage from '../components/primitives/field-error-message';
import FormRow from '../components/primitives/form-row';
import type { ChatUiConfig } from '../schema';
import type { GetUiConfigFieldError } from '../validation';

type HomeValue = ChatUiConfig['home'];

interface Props {
    home: HomeValue;
    onChange: (next: HomeValue) => void;
    disabled?: boolean;
    getError: GetUiConfigFieldError;
    errorCount?: number;
    apps?: AppType[];
    tools?: ToolType[];
}

const HomeSection = ({ home, onChange, disabled, getError, errorCount, apps, tools }: Props) => {
    const updateHome = (patch: Partial<HomeValue>) => onChange({ ...home, ...patch });

    const updateSearch = (patch: Partial<NonNullable<HomeValue['search']>>) => {
        updateHome({ search: { ...(home.search ?? {}), ...patch } });
    };

    const eligibleApps = apps ?? [];
    const eligibleTools = tools ?? [];
    const homeApp = home.homeApp;

    const updateHomeApp = (patch: Partial<NonNullable<HomeValue['homeApp']>>) => {
        if (!homeApp) return;
        updateHome({ homeApp: { ...homeApp, ...patch } });
    };

    const handleHomeAppRefChange = (refName: string | null) => {
        if (!refName) {
            updateHome({ homeApp: undefined });

            return;
        }

        updateHome({ homeApp: { ...(homeApp ?? {}), refName } });
    };

    const handleDataToolRefChange = (refName: string | null) => {
        if (!homeApp) return;

        if (!refName) {
            updateHomeApp({ dataTool: undefined });

            return;
        }

        updateHomeApp({ dataTool: { ...(homeApp.dataTool ?? {}), refName } });
    };

    const handleDataToolArgsChange = (next: unknown) => {
        if (!homeApp?.dataTool?.refName) return;

        const args =
            next && typeof next === 'object' && !Array.isArray(next) ? (next as Record<string, unknown>) : undefined;

        updateHomeApp({ dataTool: { ...homeApp.dataTool, args } });
    };

    const renderDataTool = () => (
        <div className="flex flex-col gap-1">
            <div className="text-sm font-medium">Data tool (optional)</div>
            <div className="text-xs text-text-secondary">
                Called on load to populate the app. Leave as None for apps that render without data.
            </div>
            <Select<string>
                variant="ghost"
                className="w-full rounded-md"
                disabled={disabled}
                value={homeApp?.dataTool?.refName ?? ''}
                options={[
                    { value: '', label: 'None' },
                    ...eligibleTools.map((tool) => ({ value: tool.refName, label: tool.name })),
                ]}
                onChange={(v) => handleDataToolRefChange(v || null)}
            />
            {Boolean(homeApp?.dataTool?.refName) && (
                <JsonSnippetEditor
                    label="Data tool args (JSON)"
                    description="Arguments passed to the data tool on each load."
                    readOnly={disabled}
                    value={homeApp?.dataTool?.args ?? {}}
                    onChange={handleDataToolArgsChange}
                />
            )}
        </div>
    );

    const renderHomeApp = () => {
        if (eligibleApps.length === 0) {
            return (
                <div className="text-xs text-text-secondary">
                    Attach an app in the Apps tab to use it as the home page.
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-2.5">
                <Select<string>
                    variant="ghost"
                    className="w-full rounded-md"
                    disabled={disabled}
                    value={homeApp?.refName ?? ''}
                    options={[
                        { value: '', label: 'None' },
                        ...eligibleApps.map((app) => ({ value: app.refName, label: app.name })),
                    ]}
                    onChange={(v) => handleHomeAppRefChange(v || null)}
                />
                <label className="flex cursor-pointer items-start gap-2.5">
                    <CheckboxShadcn
                        className="mt-0.5"
                        disabled={disabled || !homeApp?.refName}
                        checked={Boolean(homeApp?.refName) && homeApp?.enabled !== false}
                        onCheckedChange={(c) => updateHomeApp({ enabled: c === true })}
                    />
                    <div>
                        <div className="text-sm font-medium">Enabled</div>
                        <div className="text-xs text-text-secondary">Show this app as the landing screen</div>
                    </div>
                </label>
                {Boolean(homeApp?.refName) && renderDataTool()}
            </div>
        );
    };

    const titleError = getError('home.title');
    const incognitoTitleError = getError('home.titleIncognito');

    return (
        <AccordionSection
            id="home"
            title="Home page"
            icon={<HomeIcon className="size-3.5" />}
            required={false}
            description="Settings for the agent landing screen."
            errorCount={errorCount}
        >
            <div className="-mx-4 -mb-4 border-t border-border">
                <FormRow label="Title" sub="Main heading on the home page">
                    <Input
                        readOnly={disabled}
                        isErrored={Boolean(titleError)}
                        value={home.title ?? ''}
                        placeholder="What can I help you with?"
                        onChange={(e) => updateHome({ title: e.target.value || undefined })}
                    />
                    <FieldErrorMessage error={titleError} />
                </FormRow>
                <FormRow label="Incognito title" sub="Shown in temporary chat mode">
                    <Input
                        readOnly={disabled}
                        isErrored={Boolean(incognitoTitleError)}
                        value={home.titleIncognito ?? ''}
                        placeholder="You are in Temporary chat mode"
                        onChange={(e) => updateHome({ titleIncognito: e.target.value || undefined })}
                    />
                    <FieldErrorMessage error={incognitoTitleError} />
                </FormRow>
                <FormRow label="Start page" sub="Which tab loads first">
                    <Select<'library' | 'chat'>
                        variant="ghost"
                        className="w-full rounded-md"
                        allowDeselect
                        disabled={disabled}
                        value={home.startPage ?? null}
                        options={[
                            { value: 'chat', label: 'Chat' },
                            { value: 'library', label: 'Library' },
                        ]}
                        onChange={(v) => updateHome({ startPage: v ?? undefined })}
                    />
                </FormRow>
                <FormRow label="Home app" sub="Show a GenUI app as the landing screen">
                    {renderHomeApp()}
                </FormRow>
                <FormRow label="Starter questions" sub="Suggested prompts below the composer">
                    <StringListEditor
                        disabled={disabled}
                        value={home.questions ?? []}
                        onChange={(next) => updateHome({ questions: next.length ? next : undefined })}
                        placeholder="Type a question and press Enter"
                    />
                </FormRow>
                <FormRow label="Search placeholder">
                    <Input
                        readOnly={disabled}
                        value={home.search?.placeholder ?? ''}
                        placeholder="Ask anything…"
                        onChange={(e) => updateSearch({ placeholder: e.target.value || undefined })}
                    />
                </FormRow>
                <FormRow label="Default prompt" sub="Prefilled on first visit">
                    <TextAreaForm
                        readOnly={disabled}
                        value={home.search?.defaultPrompt ?? ''}
                        onChange={(v) => updateSearch({ defaultPrompt: v || undefined })}
                    />
                </FormRow>
                <FormRow label="Accepted files" sub="File types allowed as attachments">
                    <FileTypeSelector
                        disabled={disabled}
                        value={home.search?.accept}
                        onChange={(next) => updateSearch({ accept: next })}
                    />
                </FormRow>
                <FormRow label="Toggles" wide>
                    <div className="flex flex-col gap-2.5">
                        <label className="flex cursor-pointer items-start gap-2.5">
                            <CheckboxShadcn
                                className="mt-0.5"
                                disabled={disabled}
                                checked={home.search?.files ?? false}
                                onCheckedChange={(c) => updateSearch({ files: c === true })}
                            />
                            <div>
                                <div className="text-sm font-medium">Allow file uploads</div>
                                <div className="text-xs text-text-secondary">
                                    Show attachment button in the composer
                                </div>
                            </div>
                        </label>
                        <label className="flex cursor-pointer items-start gap-2.5">
                            <CheckboxShadcn
                                className="mt-0.5"
                                disabled={disabled}
                                checked={home.search?.showWebSearch ?? false}
                                onCheckedChange={(c) => updateSearch({ showWebSearch: c === true })}
                            />
                            <div>
                                <div className="text-sm font-medium">Show web search</div>
                                <div className="text-xs text-text-secondary">Add web-search switch to the composer</div>
                            </div>
                        </label>
                        <label className="ml-6 flex cursor-pointer items-start gap-2.5">
                            <CheckboxShadcn
                                className="mt-0.5"
                                disabled={disabled || !home.search?.showWebSearch}
                                checked={home.search?.isWebSearchEnabled ?? false}
                                onCheckedChange={(c) => updateSearch({ isWebSearchEnabled: c === true })}
                            />
                            <div>
                                <div className="text-sm font-medium">Web search on by default</div>
                            </div>
                        </label>
                        <label className="flex cursor-pointer items-start gap-2.5">
                            <CheckboxShadcn
                                className="mt-0.5"
                                disabled={disabled}
                                checked={home.search?.showDeepSearch ?? false}
                                onCheckedChange={(c) =>
                                    updateSearch(
                                        c === true
                                            ? { showDeepSearch: true }
                                            : { showDeepSearch: false, isDeepSearchEnabled: false },
                                    )
                                }
                            />
                            <div>
                                <div className="text-sm font-medium">Show deep search</div>
                                <div className="text-xs text-text-secondary">
                                    Add deep-search switch to the composer
                                </div>
                            </div>
                        </label>
                        <label className="ml-6 flex cursor-pointer items-start gap-2.5">
                            <CheckboxShadcn
                                className="mt-0.5"
                                disabled={disabled || !home.search?.showDeepSearch}
                                checked={home.search?.isDeepSearchEnabled ?? false}
                                onCheckedChange={(c) => updateSearch({ isDeepSearchEnabled: c === true })}
                            />
                            <div>
                                <div className="text-sm font-medium">Deep search on by default</div>
                            </div>
                        </label>
                        <label className="flex cursor-pointer items-start gap-2.5">
                            <CheckboxShadcn
                                className="mt-0.5"
                                disabled={disabled}
                                checked={home.search?.isIncognitoEnabled ?? false}
                                onCheckedChange={(c) => updateSearch({ isIncognitoEnabled: c === true })}
                            />
                            <div>
                                <div className="text-sm font-medium">Incognito mode available</div>
                                <div className="text-xs text-text-secondary">Let users start a temporary chat</div>
                            </div>
                        </label>
                    </div>
                </FormRow>
            </div>
        </AccordionSection>
    );
};

export default HomeSection;
