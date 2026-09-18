import { EyeIcon } from 'lucide-react';

import { CheckboxShadcn } from '@/components/ui/checkbox';
import Select from '@/components/ui/select';

import AccordionSection from '../components/primitives/accordion-section';
import FormRow from '../components/primitives/form-row';
import type { GalleryUiConfig } from '../schema';

type Toggles = Pick<
    GalleryUiConfig,
    'showPublicPrivateToggle' | 'isPublic' | 'defaultVisibilityByTab' | 'canUserChangeVisibilityByTab'
>;

const VISIBILITY_OPTIONS = [
    { value: true, label: 'Public' },
    { value: false, label: 'Private' },
];

const CAN_CHANGE_OPTIONS = [
    { value: true, label: 'Yes' },
    { value: false, label: 'No' },
];

interface Props {
    value: Toggles;
    onChange: (patch: Partial<Toggles>) => void;
    disabled?: boolean;
    errorCount?: number;
}

const TogglesSection = ({ value, onChange, disabled, errorCount }: Props) => {
    return (
        <AccordionSection
            id="toggles"
            title="Visibility Settings"
            icon={<EyeIcon className="size-3.5" />}
            required={false}
            errorCount={errorCount}
        >
            <div className="-mx-4 -mb-4 border-t border-border">
                <FormRow label="Visibility Settings" wide>
                    <div className="flex flex-col gap-2">
                        <label className="flex cursor-pointer items-start gap-2.5">
                            <CheckboxShadcn
                                className="mt-0.5"
                                disabled={disabled}
                                checked={value.showPublicPrivateToggle ?? false}
                                onCheckedChange={(c) => onChange({ showPublicPrivateToggle: c === true })}
                            />
                            <div>
                                <div className="text-sm font-medium">
                                    Show &quot;Public/Private&quot; option by Default :
                                </div>
                            </div>
                        </label>
                        <div className="ml-6 grid grid-cols-[6rem_8rem_10rem] items-center gap-x-3 gap-y-2">
                            <div />
                            <div className="text-sm font-medium">Default</div>
                            <div className="text-sm font-medium">Allow user to change</div>

                            <div className="text-sm font-medium">My Tab :</div>
                            <Select
                                variant="outline"
                                className="w-32"
                                disabled={disabled || !value.showPublicPrivateToggle}
                                options={VISIBILITY_OPTIONS}
                                value={value.defaultVisibilityByTab?.my ?? false}
                                onChange={(v) =>
                                    onChange({
                                        defaultVisibilityByTab: {
                                            fav: value.defaultVisibilityByTab?.fav ?? false,
                                            firmwide: value.defaultVisibilityByTab?.firmwide ?? true,
                                            my: v === true,
                                        },
                                    })
                                }
                            />
                            <Select
                                variant="outline"
                                className="w-24"
                                disabled={disabled || !value.showPublicPrivateToggle}
                                options={CAN_CHANGE_OPTIONS}
                                value={value.canUserChangeVisibilityByTab?.my ?? true}
                                onChange={(v) =>
                                    onChange({
                                        canUserChangeVisibilityByTab: {
                                            fav: value.canUserChangeVisibilityByTab?.fav ?? true,
                                            firmwide: value.canUserChangeVisibilityByTab?.firmwide ?? false,
                                            my: v === true,
                                        },
                                    })
                                }
                            />

                            <div className="text-sm font-medium">Favourites :</div>
                            <Select
                                variant="outline"
                                className="w-32"
                                disabled={disabled || !value.showPublicPrivateToggle}
                                options={VISIBILITY_OPTIONS}
                                value={value.defaultVisibilityByTab?.fav ?? false}
                                onChange={(v) =>
                                    onChange({
                                        defaultVisibilityByTab: {
                                            my: value.defaultVisibilityByTab?.my ?? false,
                                            firmwide: value.defaultVisibilityByTab?.firmwide ?? true,
                                            fav: v === true,
                                        },
                                    })
                                }
                            />
                            <Select
                                variant="outline"
                                className="w-24"
                                disabled={disabled || !value.showPublicPrivateToggle}
                                options={CAN_CHANGE_OPTIONS}
                                value={value.canUserChangeVisibilityByTab?.fav ?? true}
                                onChange={(v) =>
                                    onChange({
                                        canUserChangeVisibilityByTab: {
                                            my: value.canUserChangeVisibilityByTab?.my ?? true,
                                            firmwide: value.canUserChangeVisibilityByTab?.firmwide ?? false,
                                            fav: v === true,
                                        },
                                    })
                                }
                            />

                            <div className="text-sm font-medium">Firm :</div>
                            <Select
                                variant="outline"
                                className="w-32"
                                disabled={disabled || !value.showPublicPrivateToggle}
                                options={VISIBILITY_OPTIONS}
                                value={value.defaultVisibilityByTab?.firmwide ?? true}
                                onChange={(v) =>
                                    onChange({
                                        defaultVisibilityByTab: {
                                            my: value.defaultVisibilityByTab?.my ?? false,
                                            fav: value.defaultVisibilityByTab?.fav ?? false,
                                            firmwide: v === true,
                                        },
                                    })
                                }
                            />
                            <Select
                                variant="outline"
                                className="w-24"
                                disabled={disabled || !value.showPublicPrivateToggle}
                                options={CAN_CHANGE_OPTIONS}
                                value={value.canUserChangeVisibilityByTab?.firmwide ?? false}
                                onChange={(v) =>
                                    onChange({
                                        canUserChangeVisibilityByTab: {
                                            my: value.canUserChangeVisibilityByTab?.my ?? true,
                                            fav: value.canUserChangeVisibilityByTab?.fav ?? true,
                                            firmwide: v === true,
                                        },
                                    })
                                }
                            />
                        </div>
                        <p className="mt-2 text-xs text-text-secondary">
                            These toggles only apply for galleries with user-generated items.
                        </p>
                    </div>
                </FormRow>
            </div>
        </AccordionSection>
    );
};

export default TogglesSection;
