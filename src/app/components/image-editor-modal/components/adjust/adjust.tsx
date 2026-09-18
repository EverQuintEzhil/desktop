import clamp from 'lodash/clamp';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';

import { useEditorContext } from '../../context/editor-context';
import type { AdjustmentKey } from '../../types';
import { ADJUSTMENT_SECTIONS, ADJUSTMENT_CONTROLS, ACCORDION_ADJUSTMENTS } from '../../utils/adjustment-utils';
import IntensityControl from '../intensity-control';

import './adjust.scss';

interface AdjustProps {
    recordSnapshot: () => void;
}

const Adjust = (props: AdjustProps) => {
    const { recordSnapshot } = props;
    const { adjustments, setAdjustments } = useEditorContext();
    const [expandedKey, setExpandedKey] = useState<string | null>(null);

    const handleAdjustmentChange = (key: AdjustmentKey, value: number) => {
        setAdjustments((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleAccordionPropertyChange = (key: AdjustmentKey, property: string, value: number) => {
        setAdjustments((prev) => ({
            ...prev,
            [key]: {
                ...(prev[key] as Record<string, number>),
                [property]: value,
            },
        }));
    };

    const toggleAccordion = (key: string) => {
        setExpandedKey((prev) => (prev === key ? null : key));
    };

    return (
        <div className="panel-section adjust-panel flex flex-col gap-4">
            {ADJUSTMENT_SECTIONS.map((section) => (
                <div key={section.title} className="adjust-section flex flex-col gap-3 px-4">
                    <div className="adjust-section-header">
                        <span className="text-sm font-medium">{section.title}</span>
                    </div>
                    <div className="adjust-section-content flex flex-col gap-3">
                        {section.keys.map((key) => {
                            const accordionConfig = ACCORDION_ADJUSTMENTS.find((item) => item.key === key);

                            if (accordionConfig) {
                                const adjustmentValue = adjustments[key] as Record<string, number>;
                                const isExpanded = expandedKey === key;
                                const isActive = accordionConfig.controls.some(
                                    (control) => adjustmentValue[control.property] !== 0,
                                );

                                return (
                                    <div key={key} className="accordion-item flex flex-col">
                                        <div
                                            className={`accordion-adjustment flex items-center justify-between py-2 ${isExpanded || isActive ? 'active' : ''}`}
                                            onClick={() => toggleAccordion(key)}
                                        >
                                            <span className="text-xs font-medium">{accordionConfig.label}</span>
                                            {isExpanded ? (
                                                <ChevronDownIcon className="size-4" />
                                            ) : (
                                                <ChevronRightIcon className="size-4" />
                                            )}
                                        </div>

                                        {isExpanded && (
                                            <div className="accordion-content flex flex-col gap-3 pb-3">
                                                {accordionConfig.controls.map((control) => (
                                                    <div
                                                        className="adjust-row grid grid-cols-[110px_1fr] items-center gap-3"
                                                        key={control.property}
                                                    >
                                                        <span className="text-xs font-medium text-text-secondary">
                                                            {control.label}
                                                        </span>
                                                        <IntensityControl
                                                            showLabel={false}
                                                            value={adjustmentValue[control.property]}
                                                            min={control.min}
                                                            max={control.max}
                                                            step={control.step}
                                                            pattern={control.min < 0 ? '-?[0-9]*' : '[0-9]*'}
                                                            allowedPattern={control.min < 0 ? /^-?\d*$/ : /^\d*$/}
                                                            onSliderStart={recordSnapshot}
                                                            onEditStart={recordSnapshot}
                                                            onChange={(val) => {
                                                                const clampedValue = clamp(
                                                                    val,
                                                                    control.min,
                                                                    control.max,
                                                                );

                                                                handleAccordionPropertyChange(
                                                                    key,
                                                                    control.property,
                                                                    clampedValue,
                                                                );
                                                            }}
                                                            wrapperClassName=""
                                                            sliderWrapperClassName="adjust-inputs"
                                                            numberClassName="adjust-number"
                                                            rangeClassName="adjust-range"
                                                            ariaLabelNumber={`${accordionConfig.label} ${control.label} value`}
                                                            ariaLabelSlider={`${accordionConfig.label} ${control.label} slider`}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            const control = ADJUSTMENT_CONTROLS.find((item) => item.key === key);

                            if (!control) return null;

                            return (
                                <div
                                    className="adjust-row grid grid-cols-[110px_1fr] items-center gap-3"
                                    key={control.key}
                                >
                                    <span className="text-xs font-medium text-text-secondary">{control.label}</span>
                                    <IntensityControl
                                        showLabel={false}
                                        value={adjustments[control.key] as number}
                                        min={control.min}
                                        max={control.max}
                                        step={control.step ?? 1}
                                        pattern={control.min < 0 ? '-?[0-9]*' : '[0-9]*'}
                                        allowedPattern={control.min < 0 ? /^-?\d*$/ : /^\d*$/}
                                        onSliderStart={recordSnapshot}
                                        onEditStart={recordSnapshot}
                                        onChange={(val) => {
                                            const clampedValue = clamp(val, control.min, control.max);

                                            handleAdjustmentChange(control.key, clampedValue);
                                        }}
                                        wrapperClassName=""
                                        sliderWrapperClassName="adjust-inputs"
                                        numberClassName="adjust-number"
                                        rangeClassName="adjust-range"
                                        ariaLabelNumber={`${control.label} value`}
                                        ariaLabelSlider={`${control.label} slider`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Adjust;
