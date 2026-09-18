import { MinusIcon, PlusIcon } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import './stepper.scss';

export interface StepperProps {
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    tabIndex?: number;
    isDarkMode?: boolean;
}

const Stepper: React.FC<StepperProps> = ({
    value,
    min,
    max,
    step,
    onChange,
    disabled = false,
    tabIndex = 0,
    isDarkMode = false,
}) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const isTypingRef = useRef<boolean>(false);

    const validStep = Math.max(0.0001, Math.abs(step));
    const validMin = Math.min(min, max);
    const validMax = Math.max(min, max);
    const clampedValue = Math.max(validMin, Math.min(validMax, value));

    const [inputValue, setInputValue] = useState<string>(() => clampedValue.toString());

    useEffect(() => {
        if (!isTypingRef.current && document.activeElement !== inputRef.current) {
            setInputValue(clampedValue.toString());
        }
    }, [clampedValue]);

    // Calculate decimal places from step to handle floating point precision
    const getDecimalPlaces = (num: number): number => {
        if (num <= 0 || !Number.isFinite(num)) return 0;
        if (Math.floor(num) === num) return 0;

        const str = num.toString();

        if (str.includes('e-')) {
            const parts = str.split('e-');
            const exponent = parseInt(parts[1], 10);
            const mantissa = parts[0];
            const mantissaDecimals = mantissa.includes('.') ? mantissa.split('.')[1].length : 0;

            return exponent + mantissaDecimals;
        } else if (str.includes('.')) {
            return str.split('.')[1].length;
        }

        return 0;
    };

    const decimalPlaces = getDecimalPlaces(validStep);

    const roundToStep = (num: number): number => {
        const clamped = Math.max(validMin, Math.min(validMax, num));

        return Number(clamped.toFixed(decimalPlaces));
    };

    const handleDecrement = () => {
        const newValue = roundToStep(clampedValue - validStep);

        onChange(newValue);
    };

    const handleIncrement = () => {
        const newValue = roundToStep(clampedValue + validStep);

        onChange(newValue);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        isTypingRef.current = true;
        const newInputValue = e.target.value;

        setInputValue(newInputValue);
    };

    const handleInputFocus = () => {
        isTypingRef.current = true;
    };

    const handleInputBlur = () => {
        isTypingRef.current = false;
        const inputValueNum = Number(inputValue);

        if (!Number.isNaN(inputValueNum) && Number.isFinite(inputValueNum) && inputValue.trim() !== '') {
            const newValue = roundToStep(inputValueNum);

            onChange(newValue);
            setInputValue(newValue.toString());
        } else {
            setInputValue(clampedValue.toString());
        }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    const handleWrapperKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (disabled || e.target !== e.currentTarget) return;

        let handled = false;

        switch (e.key) {
            case 'Enter':
                e.currentTarget.blur();
                break;
            case 'ArrowUp':
                handleIncrement();
                handled = true;
                break;
            case 'ArrowDown':
                handleDecrement();
                handled = true;
                break;
        }

        if (handled) {
            e.preventDefault();
        }
    };

    const isDecrementDisabled = disabled || clampedValue <= validMin;
    const isIncrementDisabled = disabled || clampedValue >= validMax;

    return (
        <div className="stepper-wrapper flex items-center gap-2" tabIndex={tabIndex} onKeyDown={handleWrapperKeyDown}>
            <Button
                variant={isDarkMode ? 'black' : 'outline'}
                size="icon-sm"
                className="stepper-button flex h-7 min-h-[28px] w-7 items-center justify-center rounded-full p-0"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleDecrement();
                    }
                }}
                onClick={handleDecrement}
                disabled={isDecrementDisabled}
            >
                <MinusIcon className="size-4" />
            </Button>
            <Input
                ref={inputRef}
                type="number"
                value={inputValue}
                min={validMin}
                max={validMax}
                step={validStep}
                className={`stepper-input h-7 w-[60px] rounded-full text-center ${isDarkMode ? 'black' : ''}`}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
                disabled={disabled}
            />
            <Button
                variant={isDarkMode ? 'black' : 'outline'}
                size="icon-sm"
                className="stepper-button flex h-7 w-7 min-w-[28px] items-center justify-center rounded-full p-0"
                onClick={handleIncrement}
                disabled={isIncrementDisabled}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleIncrement();
                    }
                }}
            >
                <PlusIcon className="size-4" />
            </Button>
        </div>
    );
};

export default Stepper;
