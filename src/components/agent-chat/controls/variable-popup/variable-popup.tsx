import React, { useState, useRef, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import './variable-popup.scss';
interface VariablePopupProps {
    isOpen: boolean;
    variableName: string;
    position: { x: number; y: number };
    onClose: () => void;
    onSave: (value: string) => void;
}

const VariablePopup: React.FC<VariablePopupProps> = ({ isOpen, variableName, position, onClose, onSave }) => {
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
            setInputValue('');
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    const handleSave = () => {
        onSave(inputValue.trim());
        onClose();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | null>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSave();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            ref={popupRef}
            className="variable-popup max-w-[300px] min-w-[250px] p-4"
            style={{
                top: position.y,
                left: position.x,
            }}
        >
            <div className="flex flex-col gap-2">
                <span className="text-sm">Enter value for: {variableName}</span>
                <Input
                    ref={inputRef}
                    className="variable-popup-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.currentTarget.value)}
                    placeholder={`Enter ${variableName}`}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement | null>) => handleKeyDown(e)}
                />
                <div className="mt-1 flex items-center justify-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onClose}
                        className="h-8 flex-1 justify-center text-[13px]"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleSave}
                        disabled={!inputValue.trim()}
                        className="variable-popup-submit h-8 flex-1 justify-center text-[13px]"
                    >
                        Apply
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default VariablePopup;
