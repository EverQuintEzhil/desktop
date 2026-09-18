import { LockIcon, LockOpenIcon } from 'lucide-react';
import { useState, type CSSProperties, type ChangeEvent, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import Switch from '@/components/ui/switch';
import { ESCAPE_CANCELS_EDIT_PROPS } from '@/utils/escape-cancels-edit';

import { useCrop } from '../../hooks/use-crop';
import { PAGE_SIZE_PRESET_GROUPS, ASPECT_RATIO_PRESETS } from '../../utils/crop-utils';

import './crop.scss';

interface CropProps {
    imageUrl: string;
    recordSnapshot: () => void;
}

const Crop = (props: CropProps) => {
    const { imageUrl, recordSnapshot } = props;
    const {
        widthDraft,
        heightDraft,
        isAspectRatioLocked,
        activePreset,
        activePagePresetId,
        handleWidthFocus,
        handleHeightFocus,
        handleWidthChange,
        handleWidthBlur,
        handleWidthEscape,
        handleHeightChange,
        handleHeightBlur,
        handleHeightEscape,
        handlePresetClick,
        handlePagePresetClick,
        handleAspectRatioLockChange,
    } = useCrop({ imageUrl, recordSnapshot });

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [activeTab, setActiveTab] = useState<'aspectRatio' | 'presets'>('aspectRatio');
    const [editingDimension, setEditingDimension] = useState<'width' | 'height' | null>(null);

    // Escape cancels the dimension edit, it does not dismiss the image editor. The field cannot
    // stop the event itself — Radix's DismissableLayer listens in the capture phase on
    // `document` — so the modal defers to whichever field carries the attribute below. The mark
    // is tied to a *changed* value rather than to focus, because Radix auto-focuses the first
    // field when the modal opens and Escape must still dismiss an untouched editor.
    const cancelDimensionEdit = (
        event: KeyboardEvent<HTMLInputElement>,
        dimension: 'width' | 'height',
        cancel: () => void,
    ) => {
        if (event.key !== 'Escape') return;
        if (editingDimension !== dimension) return;

        const input = event.currentTarget;

        event.preventDefault();
        cancel();
        input.blur();
    };

    const getPresetShapeStyle = (ratio: number | null): CSSProperties => {
        const r = ratio && Number.isFinite(ratio) && ratio > 0 ? ratio : 1;

        if (r >= 1) {
            return {
                width: '100%',
                height: `${100 / r}%`,
            };
        }

        return {
            width: `${100 * r}%`,
            height: '100%',
        };
    };

    const renderAspectRatioTab = () => {
        if (activeTab !== 'aspectRatio') return null;

        return (
            <div id="crop-tab-aspect-ratio" role="tabpanel" className="flex flex-col gap-3">
                <div className="aspect-ratio-grid aspect-ratio grid grid-cols-3 gap-x-[6px] gap-y-3">
                    {ASPECT_RATIO_PRESETS.map((preset) => (
                        <button
                            key={preset.value}
                            type="button"
                            className={`aspect-ratio-preset flex flex-col items-center gap-1.5 ${activePreset === preset.value ? 'active' : ''}`}
                            onClick={() => handlePresetClick(preset)}
                        >
                            <div className="preset-icon flex items-center justify-center">
                                <div
                                    className="preset-shape"
                                    style={{
                                        ...getPresetShapeStyle(preset.ratio ?? null),
                                    }}
                                >
                                    <div className="frame">
                                        <div className="frame-edge frame-edge-top" />
                                        <div className="frame-edge frame-edge-center" />
                                        <div className="frame-edge frame-edge-bottom" />
                                    </div>
                                </div>
                            </div>
                            <span className="text-xs font-medium">{preset.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const renderPresetsTab = () => {
        if (activeTab !== 'presets') return null;

        return (
            <div id="crop-tab-presets" role="tabpanel" className="flex flex-col gap-6">
                {PAGE_SIZE_PRESET_GROUPS.map((group) => {
                    const maxVisible = 3;
                    const isExpanded = !!expandedGroups[group.id];
                    const total = group.presets.length;
                    const visible = isExpanded ? group.presets : group.presets.slice(0, maxVisible);
                    const remaining = Math.max(0, total - maxVisible);

                    return (
                        <div key={group.id} className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium">{group.title}</span>
                                {remaining > 0 && (
                                    <Button
                                        className="crop-more-button"
                                        size="xs"
                                        variant="ghost"
                                        onClick={() =>
                                            setExpandedGroups((prev) => ({
                                                ...prev,
                                                [group.id]: !prev[group.id],
                                            }))
                                        }
                                    >
                                        {isExpanded ? 'Less' : `More (${remaining})`}
                                    </Button>
                                )}
                            </div>
                            <div className="aspect-ratio-grid presets grid grid-cols-3 gap-x-[6px] gap-y-3">
                                {visible.map((preset) => {
                                    const ratio = preset.width / preset.height;
                                    const isActive = activePagePresetId === preset.id;

                                    return (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            className={`aspect-ratio-preset flex cursor-pointer flex-col items-center gap-1.5 ${isActive ? 'active' : ''}`}
                                            onClick={() => handlePagePresetClick(preset)}
                                        >
                                            <div className="preset-icon flex items-center justify-center">
                                                <div
                                                    className="preset-shape"
                                                    style={{
                                                        ...getPresetShapeStyle(ratio),
                                                    }}
                                                >
                                                    <div className="frame">
                                                        <div className="frame-edge frame-edge-top" />
                                                        <div className="frame-edge frame-edge-bottom" />
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-xs font-medium text-text-secondary">
                                                {preset.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="panel-section crop-panel flex flex-col gap-4">
            <div className="crop-section flex flex-col gap-3 px-4">
                <div className="crop-section-header">
                    <span className="text-sm font-medium">Crop Area</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="crop-inputs flex flex-1 flex-col gap-3">
                        <div className="crop-input-row flex items-center justify-between">
                            <label className="text-xs font-medium" htmlFor="cropWidth">
                                Width
                            </label>
                            <div className="crop-input-group flex items-center gap-1 px-2">
                                <input
                                    {...(editingDimension === 'width' ? ESCAPE_CANCELS_EDIT_PROPS : {})}
                                    className="crop-input h-8 w-[70px] text-right text-xs font-medium"
                                    id="cropWidth"
                                    type="number"
                                    value={widthDraft}
                                    min={0}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                        setEditingDimension('width');
                                        handleWidthChange(e.currentTarget.value);
                                    }}
                                    onFocus={handleWidthFocus}
                                    onBlur={() => {
                                        setEditingDimension(null);
                                        handleWidthBlur();
                                    }}
                                    onKeyDown={(event) => cancelDimensionEdit(event, 'width', handleWidthEscape)}
                                />
                                <span className="text-sm">px</span>
                            </div>
                        </div>
                        <div className="crop-input-row flex items-center justify-between">
                            <label className="text-xs font-medium" htmlFor="cropHeight">
                                Height
                            </label>
                            <div className="crop-input-group flex items-center gap-1 px-2">
                                <input
                                    {...(editingDimension === 'height' ? ESCAPE_CANCELS_EDIT_PROPS : {})}
                                    className="crop-input h-8 w-[70px] text-right text-xs font-medium"
                                    id="cropHeight"
                                    type="number"
                                    value={heightDraft}
                                    min={0}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                        setEditingDimension('height');
                                        handleHeightChange(e.currentTarget.value);
                                    }}
                                    onFocus={handleHeightFocus}
                                    onBlur={() => {
                                        setEditingDimension(null);
                                        handleHeightBlur();
                                    }}
                                    onKeyDown={(event) => cancelDimensionEdit(event, 'height', handleHeightEscape)}
                                />
                                <span className="text-sm">px</span>
                            </div>
                        </div>
                    </div>
                    <div className={`crop-cover-lines-container relative ${isAspectRatioLocked ? 'lock' : 'unlock'}`}>
                        <div className="cover-lines" />
                        <SimpleTooltip
                            content={isAspectRatioLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                            side="bottom"
                        >
                            <Button
                                size="xs"
                                variant="outline"
                                className={`crop-lock-button ${isAspectRatioLocked ? 'lock' : 'unlock'}`}
                                onClick={() => handleAspectRatioLockChange(!isAspectRatioLocked)}
                                aria-label={isAspectRatioLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                            >
                                {isAspectRatioLocked ? <LockIcon /> : <LockOpenIcon />}
                            </Button>
                        </SimpleTooltip>
                    </div>
                </div>
            </div>

            <div className="crop-section flex flex-col gap-3 px-4">
                <Switch
                    options={[{ label: 'Aspect Ratio' }, { label: 'Presets' }]}
                    activeIndex={activeTab === 'aspectRatio' ? 0 : 1}
                    onChange={(_, index) => {
                        setActiveTab(index === 0 ? 'aspectRatio' : 'presets');
                    }}
                    color="primary"
                    width={120}
                />

                {renderAspectRatioTab()}

                {renderPresetsTab()}
            </div>
        </div>
    );
};

export default Crop;
