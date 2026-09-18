import React, { useRef, useEffect, useState, useImperativeHandle, type HTMLProps } from 'react';

import useDidUpdate from '@/hooks/use-did-update';
import { cn } from '@/lib/utils';

import './text-area.scss';

export interface TextAreaRef {
    changeText: (value: string) => void;
    focus: () => void;
    focusAtEnd: () => void;
    element: HTMLElement | null;
}

export interface TextAreaProps extends Omit<HTMLProps<HTMLParagraphElement>, 'onChange' | 'label' | 'as' | 'ref'> {
    value?: string;
    maxWords?: number;
    onChange?: (value: string) => void;
    onEnter?: (value: string) => void;
    onCommandEnter?: (value: string) => void;
    styles?: string;
    placeholder?: string;
    isErrored?: boolean;
    ref?: React.Ref<TextAreaRef>;
    variant?: 'dark' | 'light';
}

/** Inserts pasted `text` at the caret in `editableElement`, honoring `maxWords`. */
const insertPastedText = (editableElement: HTMLElement, text: string, maxWords?: number) => {
    if (maxWords) {
        const currentText = `${editableElement.textContent} ${text}`;
        const regex = new RegExp(`^(?:\\s*\\S+(?:\\s+\\S+){0,${maxWords - 1}})?\\s*$`);

        if (!regex.test(currentText)) {
            return;
        }
    }
    document.execCommand('inserttext', false, text);
};

const TextArea = (props: TextAreaProps) => {
    const {
        disabled = false,
        placeholder,
        value: valueProp,
        onChange,
        onEnter,
        onKeyDown: onKeyDownProp,
        maxWords,
        autoFocus,
        onCommandEnter,
        isErrored,
        variant,
        className,
        styles,
        ref,
        ...rest
    } = props;

    const textArea = useRef<HTMLParagraphElement>(null);
    const clipboardEvents = ['copy', 'paste', 'cut'] as const;
    const [value, setValue] = useState(valueProp || '');

    useEffect(() => {
        if (autoFocus) {
            const el = textArea.current;

            if (el) {
                el.focus();

                if (valueProp && valueProp.length > 0) {
                    const moveCursorToEnd = () => {
                        const node = textArea.current;

                        if (node) {
                            const range = document.createRange();

                            range.selectNodeContents(node);
                            range.collapse(false);
                            const sel = window.getSelection();

                            sel?.removeAllRanges();
                            sel?.addRange(range);
                        }
                    };

                    requestAnimationFrame(() => moveCursorToEnd());
                }
            }
        }
    }, []);

    useImperativeHandle(ref as React.Ref<TextAreaRef>, () => ({
        changeText: (val: string) => {
            if (textArea.current) {
                textArea.current.innerText = val;
                setValue(val);
            }
        },
        focus: () => {
            textArea.current?.focus();
        },
        focusAtEnd: () => {
            const el = textArea.current;

            if (el) {
                el.focus();
                const range = document.createRange();

                range.selectNodeContents(el);
                range.collapse(false);
                const sel = window.getSelection();

                sel?.removeAllRanges();
                sel?.addRange(range);
            }
        },
        element: textArea.current,
    }));

    const clipboardEventHandler = (event: Event) => {
        if (event.type === 'paste') {
            const editableElement = textArea.current;
            const clipboardEvent = event as ClipboardEvent;

            if (clipboardEvent.clipboardData) {
                if (editableElement) {
                    event.preventDefault();
                    if (typeof document !== 'undefined') {
                        const text = clipboardEvent.clipboardData.getData('text/plain');

                        insertPastedText(editableElement, text, maxWords);
                    }
                }
            }
        }
    };

    useEffect(() => {
        const editableElement = textArea.current;

        if (editableElement) {
            clipboardEvents.forEach((clipboardEvent: string) => {
                editableElement.addEventListener(clipboardEvent, clipboardEventHandler);
            });
        }

        return () => {
            clipboardEvents.forEach((clipboardEvent) => {
                if (editableElement) {
                    editableElement.removeEventListener(clipboardEvent, clipboardEventHandler);
                }
            });
        };
    }, []);

    useEffect(() => {
        if (document.activeElement !== textArea?.current && !autoFocus) {
            if (textArea.current && typeof valueProp === 'string') {
                if (valueProp === '') {
                    textArea.current.innerHTML = '';
                } else {
                    textArea.current.innerText = valueProp;
                }
            }
        }
    }, [valueProp]);

    useEffect(() => {
        if (autoFocus) {
            if (textArea.current && typeof valueProp === 'string') {
                textArea.current.innerText = valueProp;
            }
        }
    }, []);

    useDidUpdate(() => {
        if (onChange) {
            onChange(value);
        }
    }, [value]);

    const onInput = () => {
        if (textArea?.current) {
            const rawText = textArea.current.innerText || '';
            const cleaned = rawText.replace(/\u200B/g, '');

            if (cleaned.trim().length === 0) {
                textArea.current.innerHTML = '';
                setValue('');
            } else {
                if (cleaned !== rawText) {
                    textArea.current.innerText = cleaned;
                }
                setValue(cleaned);
            }
        }
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLParagraphElement>) => {
        if (event.key === 'Enter') {
            if (onEnter) {
                onEnter((event.currentTarget as HTMLParagraphElement).innerText);
            }
            if ((event.metaKey && event.key === 'Enter') || (event.ctrlKey && event.key === 'Enter')) {
                if (onCommandEnter) {
                    onCommandEnter((event.currentTarget as HTMLParagraphElement).innerText);
                }
            }
        }
        if (maxWords) {
            const regex = new RegExp(`^(?:\\s*\\S+(?:\\s+\\S+){0,${maxWords - 1}})?\\s*$`);
            const target = event.target as HTMLParagraphElement;

            if (
                !regex.test(target.innerText) &&
                event.keyCode !== 8 &&
                event.keyCode !== 37 &&
                event.keyCode !== 38 &&
                event.keyCode !== 39 &&
                event.keyCode !== 40 &&
                !event.metaKey
            ) {
                event.preventDefault();
            }
        }
        if (onKeyDownProp) {
            onKeyDownProp(event);
        }
    };

    return (
        <div className={cn('text-area-wrapper content-editable notranslate relative block', isErrored && 'has-error')}>
            {styles ? <style>{`.text-area-wrapper { ${styles} }`}</style> : null}
            <p
                {...rest}
                className={cn('textarea', disabled && 'disabled', variant === 'dark' && 'dark-mode', className)}
                contentEditable={!disabled}
                onInput={onInput}
                onKeyDown={onKeyDown}
                ref={textArea}
                {...(placeholder != null ? { 'data-placeholder': placeholder } : {})}
            />
        </div>
    );
};

export default TextArea;
