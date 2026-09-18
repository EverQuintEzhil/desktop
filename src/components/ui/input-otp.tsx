import { OTPInput, OTPInputContext, REGEXP_ONLY_DIGITS } from 'input-otp';
import { MinusIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

type OTPInputContextValue = {
    slots?: Array<{ char?: string; hasFakeCaret?: boolean; isActive?: boolean }>;
};

function InputOTPRoot({
    className,
    containerClassName,
    pushPasswordManagerStrategy = 'none',
    ...props
}: React.ComponentProps<typeof OTPInput> & {
    containerClassName?: string;
}) {
    return (
        <OTPInput
            data-slot="input-otp"
            pushPasswordManagerStrategy={pushPasswordManagerStrategy}
            containerClassName={cn('flex items-center gap-2 has-disabled:opacity-50', containerClassName)}
            className={cn('disabled:cursor-not-allowed', className)}
            {...props}
        />
    );
}

function InputOTPGroupRoot({ className, ...props }: React.ComponentProps<'div'>) {
    return <div data-slot="input-otp-group" className={cn('flex items-center', className)} {...props} />;
}

function InputOTPSlotRoot({
    index,
    className,
    ...props
}: React.ComponentProps<'div'> & {
    index: number;
}) {
    const inputOTPContext = React.useContext(OTPInputContext) as OTPInputContextValue | undefined;
    const { char, hasFakeCaret, isActive } = inputOTPContext?.slots?.[index] ?? {};

    return (
        <div
            data-slot="input-otp-slot"
            data-active={isActive}
            className={cn(
                'data-[active=true]:border-ring data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:ring-destructive/20 ' +
                    'aria-invalid:border-destructive dark:data-[active=true]:aria-invalid:ring-destructive/40 ' +
                    'relative flex h-9 w-9 border-input data-[active=true]:aria-invalid:border-destructive dark:bg-input/30 ' +
                    'items-center justify-center text-sm transition-all outline-none ' +
                    'data-[active=true]:z-10',
                className,
            )}
            {...props}
        >
            {char}
            {hasFakeCaret && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
                </div>
            )}
        </div>
    );
}

function InputOTPSeparatorRoot({ ...props }: React.ComponentProps<'div'>) {
    return (
        <div data-slot="input-otp-separator" role="separator" {...props}>
            <MinusIcon />
        </div>
    );
}

export interface OtpInputError {
    state: boolean;
    message: string;
}

export interface OtpInputProps {
    /** Number of OTP slots (default: 4) */
    numOfInputs?: number;
    /** Controlled OTP string value */
    value?: string;
    /** Called with the full OTP string on every change */
    onChange: (otp: string) => void;
    /** Restrict input to numeric digits only */
    isInputNumber?: boolean;
    /** Disable all inputs */
    disabled?: boolean;
    /** Error state — shows border highlight and message */
    error?: OtpInputError;
    /** Legacy inline CSS string forwarded to the wrapper */
    styles?: string;
    /** Mask characters (password-style display) */
    secure?: boolean;
    /** Auto-focus the first slot on mount */
    shouldAutoFocus?: boolean;
    /** Called when all slots are filled */
    onSubmit?: () => void;
    /** Called when Enter is pressed and all slots are filled */
    onEnter?: () => void;
    /** Additional className for the wrapper */
    className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Shadcn-based drop-in replacement for the custom `OtpInput` component.
 *
 * Leverages the `input-otp` library (via shadcn) which handles internally:
 * - Per-slot focus management & keyboard navigation (arrows, backspace, delete)
 * - Paste handling (distributes across slots from caret position)
 * - Space-key blocking
 *
 * Additional custom behaviour added on top:
 * - `isInputNumber` — numeric inputMode + digit-only pattern
 * - `secure` — masks input as password
 * - `shouldAutoFocus` — focuses first slot on mount
 * - `onSubmit` — fires via `onComplete` when all slots are filled
 * - `onEnter` — fires on Enter key when all slots are filled
 * - `error` — destructive slot styling + error message below
 * - `styles` — legacy inline-CSS fallback forwarded as className
 */
const OtpInput = (props: OtpInputProps) => {
    const {
        numOfInputs = 4,
        value = '',
        onChange,
        isInputNumber = false,
        disabled = false,
        error,
        styles = '',
        secure = false,
        shouldAutoFocus = false,
        onSubmit,
        onEnter,
        className,
    } = props;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && value.length === numOfInputs) {
            onEnter?.();
        }
    };

    return (
        <div
            className={cn('flex flex-col gap-2', error?.state && 'pb-4', className)}
            // Forward legacy `styles` as an inline style string via a style tag trick
            // Using a wrapping span with style attr for the $styles pattern
            style={styles ? ({ cssText: styles } as React.CSSProperties) : undefined}
        >
            <InputOTPRoot
                maxLength={numOfInputs}
                value={value}
                onChange={onChange}
                onComplete={onSubmit}
                autoFocus={shouldAutoFocus}
                disabled={disabled}
                // Numeric-only: restrict keyboard to digits
                pattern={isInputNumber ? REGEXP_ONLY_DIGITS : undefined}
                // Secure / password masking
                textAlign="center"
                onKeyDown={handleKeyDown}
                // Push password type down to the hidden input via render prop approach
                // input-otp exposes `render` for custom slot rendering but type is
                // set on the hidden input automatically when we use pushPasswordManagerStrategy
                containerClassName={cn('flex items-start justify-start gap-2')}
                className={cn(secure && '[&_input]:[-webkit-text-security:disc]')}
                type={secure ? 'password' : 'text'}
            >
                <InputOTPGroupRoot className="gap-2">
                    {Array.from({ length: numOfInputs }).map((_, i) => (
                        <InputOTPSlotRoot
                            key={`otp-slot-${i}`}
                            index={i}
                            className={cn(
                                // Base sizing — matches original 50×50px underline style
                                'size-[50px] text-xl font-medium text-(--text-primary)',
                                // Underline only (no side borders, no top border)
                                'rounded-none border-0 border-x-0 border-t-0 border-b-2 border-border-secondary',
                                // Active (focused) slot: brand colour underline + no ring box
                                'data-[active=true]:border-b-2',
                                'data-[active=true]:border-primary',
                                'dark:bg-transparent',
                                // Error styling
                                error?.state && 'border-destructive data-[active=true]:border-destructive',
                                // Disabled
                                disabled && 'cursor-not-allowed opacity-50',
                            )}
                        />
                    ))}
                </InputOTPGroupRoot>
            </InputOTPRoot>

            {error?.state && error.message && (
                <small className="text-xs font-medium text-destructive">{error.message}</small>
            )}
        </div>
    );
};

export default OtpInput;

export { InputOTPRoot, InputOTPGroupRoot, InputOTPSlotRoot, InputOTPSeparatorRoot };
