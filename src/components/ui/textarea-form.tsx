import * as React from 'react';
import { useRef, useEffect, useImperativeHandle, useCallback } from 'react';

import { cn } from '@/lib/utils';

function TextareaRoot({ className, ...props }: React.ComponentProps<'textarea'>) {
    const isFullHeight = className?.split(/\s+/).includes('h-full');

    return (
        <textarea
            data-slot="textarea"
            className={cn(
                'textarea-form border-border-secondary placeholder:text-muted-foreground',
                'focus-visible:border-primary focus-visible:outline-none',
                'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
                'dark:bg-input/30',
                'flex w-full rounded-md border bg-transparent',
                'px-3 py-2 text-base',
                'disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                isFullHeight ? 'field-sizing-fixed h-full max-h-none' : 'field-sizing-content max-h-[34svh] min-h-16',
                className,
            )}
            {...props}
        />
    );
}

/**
 * Imperative handle exposed via `ref` — mirrors the existing `TextAreaRef`.
 * `element` is an `HTMLTextAreaElement` here (vs `HTMLParagraphElement` in the
 * original contentEditable impl).
 */
export interface TextAreaFormRef {
    /** Programmatically set the textarea value */
    changeText: (value: string) => void;
    /** Focus the textarea */
    focus: () => void;
    /** Focus and move cursor to end */
    focusAtEnd: () => void;
    /** Direct reference to the underlying HTMLTextAreaElement */
    element: HTMLTextAreaElement | null;
}

export interface TextAreaProps extends Omit<React.ComponentProps<'textarea'>, 'onChange' | 'ref' | 'value'> {
    /** Controlled value */
    value?: string;
    /** Maximum number of words allowed */
    maxWords?: number;
    /** Called with the raw string value on every change */
    onChange?: (value: string) => void;
    /** Called when Enter is pressed (without modifier) */
    onEnter?: (value: string) => void;
    /** Called when Cmd/Ctrl + Enter is pressed */
    onCommandEnter?: (value: string) => void;
    /** Inline CSS string (legacy compatibility) */
    styles?: string;
    /** Shows error styling when true */
    isErrored?: boolean;
    /** Forward ref that resolves to TextAreaRef */
    ref?: React.Ref<TextAreaFormRef>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countWords(text: string): number {
    return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

function isWordLimitExceeded(text: string, maxWords: number): boolean {
    return countWords(text) >= maxWords;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * -based drop-in replacement for the custom `TextArea` component.
 *
 * Supported features:
 * - Controlled `value` with `onChange(string)` callback
 * - `maxWords` — hard cap on word count (blocks input & paste beyond limit)
 * - `onEnter` — fires on plain Enter key press
 * - `onCommandEnter` — fires on Cmd/Ctrl + Enter
 * - `isErrored` — adds destructive ring styling
 * - `styles` — legacy inline-CSS string forwarded to the wrapper div
 * - `autoFocus` — focuses on mount and moves cursor to end when value is set
 * - `TextAreaRef` imperative handle: `changeText`, `focus`, `focusAtEnd`, `element`
 */
const TextAreaForm = (props: TextAreaProps) => {
    const {
        value = '',
        maxWords,
        onChange,
        onEnter,
        onCommandEnter,
        onKeyDown: onKeyDownProp,
        styles = '',
        isErrored,
        disabled = false,
        autoFocus,
        className,
        ref,
        placeholder,
        ...rest
    } = props;

    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    const classes = className?.split(/\s+/) || [];
    const isFullHeight = classes.includes('h-full');
    const isFlex = classes.includes('flex-1');

    // ── Imperative handle ──────────────────────────────────────────────────
    useImperativeHandle(ref as React.Ref<TextAreaFormRef>, () => ({
        changeText: (val: string) => {
            if (textAreaRef.current) {
                // Update the DOM value directly for uncontrolled scenarios
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype,
                    'value',
                )?.set;

                nativeInputValueSetter?.call(textAreaRef.current, val);
                textAreaRef.current.dispatchEvent(new Event('input', { bubbles: true }));
            }
        },
        focus: () => {
            textAreaRef.current?.focus();
        },
        focusAtEnd: () => {
            const el = textAreaRef.current;

            if (el) {
                el.focus();
                el.setSelectionRange(el.value.length, el.value.length);
            }
        },
        element: textAreaRef.current,
    }));

    // ── Auto-focus + cursor-at-end ─────────────────────────────────────────
    useEffect(() => {
        if (autoFocus) {
            const el = textAreaRef.current;

            if (el) {
                el.focus();
                if (value && value.length > 0) {
                    requestAnimationFrame(() => {
                        el.setSelectionRange(el.value.length, el.value.length);
                    });
                }
            }
        }
        // Run once on mount
    }, []);

    // ── onChange handler ───────────────────────────────────────────────────
    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const raw = e.target.value;

            if (maxWords && isWordLimitExceeded(raw, maxWords + 1)) {
                // Block the update: restore previous value
                if (textAreaRef.current) {
                    textAreaRef.current.value = value;
                }

                return;
            }

            onChange?.(raw);
        },
        [maxWords, onChange, value],
    );

    // ── Paste handler (mirrors maxWords enforcement in original) ───────────
    const handlePaste = useCallback(
        (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
            if (!maxWords) return;

            const pastedText = e.clipboardData.getData('text/plain');
            const el = textAreaRef.current;

            if (!el) return;

            const currentText = el.value;
            const selectionStart = el.selectionStart ?? currentText.length;
            const selectionEnd = el.selectionEnd ?? currentText.length;
            const combinedText = currentText.slice(0, selectionStart) + pastedText + currentText.slice(selectionEnd);

            if (isWordLimitExceeded(combinedText, maxWords + 1)) {
                e.preventDefault();
            }
        },
        [maxWords],
    );

    // ── KeyDown handler ────────────────────────────────────────────────────
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter') {
                // Plain Enter
                if (onEnter) {
                    onEnter(e.currentTarget.value);
                }
                // Cmd/Ctrl + Enter
                if ((e.metaKey || e.ctrlKey) && onCommandEnter) {
                    onCommandEnter(e.currentTarget.value);
                }
            }

            // Block further input when at word limit (allow navigation / delete)
            if (maxWords) {
                const target = e.currentTarget;
                const navKeys = [
                    'Backspace',
                    'Delete',
                    'ArrowLeft',
                    'ArrowRight',
                    'ArrowUp',
                    'ArrowDown',
                    'Home',
                    'End',
                    'Tab',
                ];

                if (
                    !navKeys.includes(e.key) &&
                    !e.metaKey &&
                    !e.ctrlKey &&
                    isWordLimitExceeded(target.value, maxWords)
                ) {
                    e.preventDefault();
                }
            }

            onKeyDownProp?.(e);
        },
        [maxWords, onEnter, onCommandEnter, onKeyDownProp],
    );

    return (
        <div
            className={cn(
                'relative block',
                isFullHeight && 'h-full',
                isFlex && 'flex-1',
                isErrored && 'pb-5',
                styles, // legacy inline styles passed as className string
            )}
        >
            <TextareaRoot
                {...rest}
                ref={textAreaRef}
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                autoFocus={autoFocus}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                className={cn(
                    // Base sizing & typography
                    'min-h-[200px] resize-y bg-card leading-relaxed',
                    // Scrollbar
                    '[&::-webkit-scrollbar]:w-1.5',
                    '[&::-webkit-scrollbar-track]:rounded [&::-webkit-scrollbar-track]:bg-muted',
                    '[&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30',
                    'hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50',
                    // Error state — override ring colour
                    isErrored &&
                        'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20',
                    className,
                )}
            />
        </div>
    );
};

export { TextareaRoot };
export default TextAreaForm;
