import clamp from 'lodash/clamp';
import { PencilIcon } from 'lucide-react';
import {
    useEffect,
    useRef,
    useState,
    useMemo,
    useCallback,
    memo,
    type ReactNode,
    type KeyboardEvent,
    type ChangeEvent,
} from 'react';

import { Button } from '@/components/ui/button';
import { ESCAPE_CANCELS_EDIT_PROPS } from '@/utils/escape-cancels-edit';

import '../shared/slider.scss';

import './intensity-control.scss';

interface IntensityControlProps {
    label?: ReactNode;
    showLabel?: boolean;
    value: number;
    displayValue?: string;
    min: number;
    max: number;
    step?: number;
    pattern: string;
    allowedPattern: RegExp;
    disabled?: boolean;
    onChange: (value: number) => void;
    onSliderStart?: () => void;
    // Fires once per edit session, at the first commit that actually changes the value.
    onEditStart?: () => void;
    wrapperClassName?: string;
    sliderWrapperClassName?: string;
    numberClassName?: string;
    rangeClassName?: string;
    ariaLabelNumber?: string;
    ariaLabelSlider?: string;
}

const IntensityControl = (props: IntensityControlProps) => {
    const {
        label,
        showLabel = true,
        value,
        displayValue,
        min,
        max,
        step = 1,
        pattern,
        allowedPattern,
        disabled = false,
        onChange,
        onSliderStart,
        onEditStart,
        wrapperClassName,
        sliderWrapperClassName,
        numberClassName,
        rangeClassName,
        ariaLabelNumber,
        ariaLabelSlider,
    } = props;
    const isDraggingRef = useRef<boolean>(false);
    const [inputValue, setInputValue] = useState<string | undefined>(undefined);
    const [isEditing, setIsEditing] = useState(false);
    const editInputRef = useRef<HTMLInputElement | null>(null);
    const editButtonRef = useRef<HTMLButtonElement | null>(null);
    const rafIdRef = useRef<number | null>(null);
    const isEscapingRef = useRef<boolean>(false);
    const committedValueRef = useRef<number | null>(null);
    const hasChangedValueRef = useRef<boolean>(false);

    useEffect(() => {
        if (!isEditing) return;

        const id = window.requestAnimationFrame(() => {
            editInputRef.current?.focus();
            editInputRef.current?.select?.();
        });

        return () => window.cancelAnimationFrame(id);
    }, [isEditing]);

    useEffect(() => {
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const handleGlobalPointerUp = () => {
            // If the pointer is released outside the slider, ensure we reset drag state.
            if (isDraggingRef.current) {
                isDraggingRef.current = false;
            }
        };

        window.addEventListener('pointerup', handleGlobalPointerUp);
        window.addEventListener('pointercancel', handleGlobalPointerUp);

        return () => {
            window.removeEventListener('pointerup', handleGlobalPointerUp);
            window.removeEventListener('pointercancel', handleGlobalPointerUp);
        };
    }, []);

    const handleRangePointerDown = useCallback(() => {
        if (disabled) return;
        if (!isDraggingRef.current) {
            isDraggingRef.current = true;
            onSliderStart?.();
        }
    }, [disabled, onSliderStart]);

    const handleRangePointerUp = useCallback(() => {
        if (isDraggingRef.current) {
            isDraggingRef.current = false;
        }
    }, []);

    const handleNumberFocus = useCallback(() => {
        if (disabled) return;
        setInputValue(String(value));
    }, [disabled, value]);

    // The undo snapshot is taken at the first value-changing commit rather than when the field
    // opens, so opening the pencil and leaving without a change records nothing.
    const commitEditValue = useCallback(
        (nextValue: number) => {
            if (nextValue !== value && !hasChangedValueRef.current) {
                hasChangedValueRef.current = true;
                onEditStart?.();
            }

            onChange(nextValue);
        },
        [onChange, onEditStart, value],
    );

    const endEditSession = useCallback(() => {
        committedValueRef.current = null;
        hasChangedValueRef.current = false;
    }, []);

    const handleNumberChange = useCallback(
        (raw: string) => {
            if (!allowedPattern.test(raw)) {
                return;
            }

            setInputValue(raw);

            if (raw === '' || raw === '-') {
                return;
            }

            const nextValue = Number(raw);

            if (Number.isNaN(nextValue)) {
                return;
            }

            const clampedValue = clamp(nextValue, min, max);

            commitEditValue(clampedValue);
        },
        [allowedPattern, min, max, commitEditValue],
    );

    const handleNumberBlur = useCallback(() => {
        setIsEditing(false);

        // Escape blurs the input to leave edit mode. Its setInputValue(undefined) has not been
        // applied yet when this runs, so without the flag the discarded draft is committed.
        if (isEscapingRef.current) {
            isEscapingRef.current = false;
            setInputValue(undefined);
            endEditSession();

            return;
        }

        if (inputValue === undefined) {
            endEditSession();

            return;
        }

        if (inputValue === '' || inputValue === '-') {
            setInputValue(undefined);
            commitEditValue(clamp(0, min, max));
            endEditSession();

            return;
        }

        const nextValue = Number(inputValue);

        if (!Number.isNaN(nextValue)) {
            commitEditValue(clamp(nextValue, min, max));
        }
        setInputValue(undefined);
        endEditSession();
    }, [inputValue, min, max, commitEditValue, endEditSession]);

    const handleNumberKeyDown = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
            if (disabled) return;

            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();

                const multiplier = event.shiftKey ? 10 : 1;
                const delta = (event.key === 'ArrowUp' ? 1 : -1) * step * multiplier;
                const base = (() => {
                    const raw = event.currentTarget.value;

                    // An incomplete draft is not a base to step from: Number('') is 0, so without
                    // this an arrow key on a cleared field would step from zero, not the value.
                    if (raw === '' || raw === '-') {
                        return value;
                    }

                    const n = Number(raw);

                    return Number.isFinite(n) ? n : value;
                })();
                const next = clamp(base + delta, min, max);

                setInputValue(String(next));
                commitEditValue(next);

                return;
            }

            if (event.key === 'Enter') {
                handleNumberChange(event.currentTarget.value);
                event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
                const input = event.currentTarget;
                const committedValue = committedValueRef.current;
                const hasChangedValue = hasChangedValueRef.current;

                // Escape here cancels the field edit, it does not dismiss the surrounding dialog.
                // Stopping propagation only covers bubble-phase listeners; the Radix DismissableLayer
                // listens in the capture phase on `document`, so the dialog defers to this field
                // through the ESCAPE_CANCELS_EDIT attribute on the input instead.
                event.preventDefault();
                event.stopPropagation();

                isEscapingRef.current = true;
                setIsEditing(false);
                setInputValue(undefined);
                input.blur();
                editButtonRef.current?.focus();

                // Typing commits live so the canvas previews it, so cancelling has to write the
                // pre-edit value back rather than simply skip a commit.
                if (committedValue !== null && hasChangedValue) {
                    onChange(committedValue);
                }
            }
        },
        [disabled, step, value, min, max, onChange, handleNumberChange, commitEditValue],
    );

    const handleEditClick = useCallback(() => {
        if (disabled) return;
        committedValueRef.current = value;
        hasChangedValueRef.current = false;
        setIsEditing(true);
        setInputValue(String(value));
    }, [disabled, value]);

    const handleSliderChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const nextValue = Number(event.target.value);

            // Cancel any pending frame
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
            }

            // Schedule update for next frame (throttle to ~60fps)
            rafIdRef.current = requestAnimationFrame(() => {
                rafIdRef.current = null;
                onChange(nextValue);
            });
        },
        [onChange],
    );

    const sliderMetrics = useMemo(() => {
        const range = max - min;
        const valuePercent = range ? ((value - min) / range) * 100 : 0;
        const zeroPercent = range ? ((0 - min) / range) * 100 : 0;
        const left = Math.min(valuePercent, zeroPercent);
        const width = Math.abs(valuePercent - zeroPercent);

        return {
            valuePercent,
            zeroPercent,
            left,
            width,
        };
    }, [min, max, value]);

    const intensityRowClassName = [
        'intensity-control-row w-full min-w-0 flex-1 flex items-center gap-2',
        isEditing && 'is-editing',
    ]
        .filter(Boolean)
        .join(' ');

    const renderLabel = () => {
        if (!showLabel || label == null) return null;

        return <span className="text-xs font-medium">{label}</span>;
    };

    const renderEditButton = () => {
        if (disabled) return null;

        return (
            <Button
                ref={editButtonRef}
                className="intensity-edit-btn"
                variant="outline"
                size="icon-xs"
                aria-label="Edit value"
                onClick={handleEditClick}
            >
                <PencilIcon />
            </Button>
        );
    };

    const renderSliderInput = () => {
        if (isEditing) {
            return (
                <input
                    ref={editInputRef}
                    {...ESCAPE_CANCELS_EDIT_PROPS}
                    className={`slider-number-input is-editing ${numberClassName ?? 'filter-number'}`}
                    type="text"
                    inputMode="numeric"
                    pattern={pattern}
                    disabled={disabled}
                    value={inputValue !== undefined ? inputValue : String(value)}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => handleNumberChange(event.target.value)}
                    onFocus={handleNumberFocus}
                    onBlur={handleNumberBlur}
                    onKeyDown={handleNumberKeyDown}
                    aria-label={ariaLabelNumber ?? 'Intensity'}
                />
            );
        }

        return (
            <>
                <input
                    className={`slider-number-input ${numberClassName ?? 'filter-number'}`}
                    type="text"
                    inputMode="numeric"
                    pattern={pattern}
                    value={displayValue ?? String(value)}
                    aria-label={ariaLabelNumber ?? 'Intensity'}
                    readOnly
                />
                <div
                    className="slider-fill"
                    style={{ left: `${sliderMetrics.left}%`, width: `${sliderMetrics.width}%` }}
                />
                <div className="slider-center-mark" style={{ left: `${sliderMetrics.zeroPercent}%` }} />
                <input
                    className={`slider-range-input ${rangeClassName ?? 'filter-range'}`}
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    disabled={disabled}
                    onChange={handleSliderChange}
                    onPointerDown={handleRangePointerDown}
                    onPointerUp={handleRangePointerUp}
                    onPointerCancel={handleRangePointerUp}
                    onMouseLeave={handleRangePointerUp}
                    aria-label={ariaLabelSlider ?? 'Intensity slider'}
                />
            </>
        );
    };

    return (
        <div className={wrapperClassName ?? 'filter-item-controls flex items-center justify-between gap-3'}>
            {renderLabel()}
            <div className={intensityRowClassName}>
                {renderEditButton()}

                <div
                    className={`${sliderWrapperClassName ?? 'filter-inputs'} intensity-slider slider-wrapper flex h-7 w-full min-w-0 flex-1 items-center gap-3`}
                >
                    {renderSliderInput()}
                </div>
            </div>
        </div>
    );
};

export default memo(IntensityControl);
