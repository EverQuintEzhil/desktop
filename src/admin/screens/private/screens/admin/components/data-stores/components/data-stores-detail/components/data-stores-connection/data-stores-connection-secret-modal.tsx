import { XIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CopyButton } from '@/components';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OtpInput from '@/components/ui/input-otp';
import SpinnerBlade from '@/components/ui/spinner';
import {
    useWizardGetConnectionSecretMutation,
    useWizardSendConnectionSecretOtpMutation,
    useWizardVerifyConnectionSecretOtpMutation,
} from '@/lib/api/admin/data-stores';
import { showSuccessToast } from '@/utils';

type SecretModalStep =
    | 'idle'
    | 'requesting-otp'
    | 'otp-sent'
    | 'verifying'
    | 'loading-secret'
    | 'secret-loaded'
    | 'token-expired'
    | 'error';
type DisplaySecretEntry = [string, string | boolean];

interface Props {
    dataStoreId: string;
    isOpen: boolean;
    onClose: () => void;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
    const apiError = error as { response?: { data?: { message?: string } }; message?: string };

    return apiError.response?.data?.message || apiError.message || fallback;
};

const formatSecret = (secret: unknown): string => {
    if (typeof secret === 'string') return secret;

    return JSON.stringify(secret ?? {}, null, 2);
};

const getDisplaySecretEntries = (secret: unknown): DisplaySecretEntry[] => {
    if (!secret || typeof secret !== 'object' || Array.isArray(secret)) return [];

    return Object.entries(secret).filter(
        (entry): entry is DisplaySecretEntry => typeof entry[1] === 'string' || typeof entry[1] === 'boolean',
    );
};

const DataStoresConnectionSecretModal = ({ dataStoreId, isOpen, onClose }: Props) => {
    const sendOtpMutation = useWizardSendConnectionSecretOtpMutation();
    const verifyOtpMutation = useWizardVerifyConnectionSecretOtpMutation();
    const getSecretMutation = useWizardGetConnectionSecretMutation();

    const wasOpenRef = useRef(false);
    const otpRef = useRef('');

    const [step, setStep] = useState<SecretModalStep>('idle');
    const [otp, setOtp] = useState('');
    const [secret, setSecret] = useState<unknown>();
    const [errorMessage, setErrorMessage] = useState('');

    const formattedSecret = useMemo(() => formatSecret(secret), [secret]);
    const displaySecretEntries = useMemo(() => getDisplaySecretEntries(secret), [secret]);

    const resetTransientState = useCallback(() => {
        setStep('idle');
        otpRef.current = '';
        setOtp('');
        setSecret(undefined);
        setErrorMessage('');
    }, []);

    const handleClose = useCallback(() => {
        resetTransientState();
        onClose();
    }, [onClose, resetTransientState]);

    const handleSendOtp = useCallback(async () => {
        setStep('requesting-otp');
        otpRef.current = '';
        setOtp('');
        setSecret(undefined);
        setErrorMessage('');

        try {
            await sendOtpMutation.mutateAsync(dataStoreId);
            setStep('otp-sent');
            showSuccessToast('OTP sent successfully.');
        } catch (error) {
            console.error(error);
            setStep('error');
            setErrorMessage(getErrorMessage(error, 'Failed to send OTP. Please try again.'));
        }
    }, [dataStoreId, sendOtpMutation]);

    const loadSecret = useCallback(
        async (isInitialLoad = false) => {
            setStep('loading-secret');
            setErrorMessage('');
            setSecret(undefined);

            try {
                const nextSecret = await getSecretMutation.mutateAsync(dataStoreId);

                setSecret(nextSecret);
                setStep('secret-loaded');
            } catch (error) {
                console.error(error);
                otpRef.current = '';
                setOtp('');
                setSecret(undefined);

                if (isInitialLoad) {
                    void handleSendOtp();
                } else {
                    setStep('token-expired');
                    const errorMessage = getErrorMessage(error, 'Failed to send OTP. Please try again.');

                    if (errorMessage.includes("Secrets Manager can't find the specified secret")) {
                        setErrorMessage("Can't find the specified secret. May be connection never created.");
                    } else {
                        setErrorMessage('Access expired. Send OTP to view secrets again.');
                    }
                }
            }
        },
        [dataStoreId, getSecretMutation, handleSendOtp],
    );

    const handleVerifyOtp = useCallback(async () => {
        const nextOtp = otpRef.current || otp;

        if (nextOtp.length !== 6) {
            setErrorMessage('Enter the 6 digit OTP.');

            return;
        }

        if (verifyOtpMutation.isPending || getSecretMutation.isPending) return;

        setStep('verifying');
        setErrorMessage('');

        try {
            await verifyOtpMutation.mutateAsync({
                id: dataStoreId,
                otp: nextOtp,
            });

            await loadSecret(false);
        } catch (error) {
            console.error(error);
            otpRef.current = '';
            setOtp('');
            setStep('otp-sent');
            setErrorMessage(getErrorMessage(error, 'Invalid OTP. Please try again.'));
        }
    }, [dataStoreId, getSecretMutation.isPending, loadSecret, otp, verifyOtpMutation]);

    useEffect(() => {
        if (!isOpen) {
            wasOpenRef.current = false;
            resetTransientState();

            return;
        }

        if (wasOpenRef.current) return;

        wasOpenRef.current = true;

        void loadSecret(true);
    }, [isOpen, loadSecret, resetTransientState]);

    const handleOtpChange = (nextOtp: string) => {
        const sanitizedOtp = nextOtp.replace(/\D/g, '').slice(0, 6);

        otpRef.current = sanitizedOtp;
        setOtp(sanitizedOtp);
        setErrorMessage('');
    };

    const renderLoadingState = (message: string) => (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <SpinnerBlade className="scale-75" />
            <span>{message}</span>
        </div>
    );

    const renderOtpInput = () => (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
                Enter the 6 digit OTP sent to your account to view the connection secrets.
            </p>
            <OtpInput
                numOfInputs={6}
                value={otp}
                onChange={handleOtpChange}
                isInputNumber
                disabled={step === 'verifying'}
                shouldAutoFocus
                onEnter={() => {
                    void handleVerifyOtp();
                }}
                onSubmit={() => {
                    void handleVerifyOtp();
                }}
                error={errorMessage ? { state: true, message: errorMessage } : undefined}
            />
        </div>
    );

    const renderSecretValue = (value: string | boolean) => {
        const displayValue = String(value);

        if (displayValue === '') {
            return <p className="text-xs leading-6 text-muted-foreground italic">Empty</p>;
        }

        return <p className="text-xs leading-6 wrap-break-word whitespace-pre-wrap text-foreground">{displayValue}</p>;
    };

    const renderSecretCopyButton = (value: string | boolean) => {
        if (typeof value !== 'string') return null;

        const displayValue = String(value);

        if (displayValue === '') return null;

        return <CopyButton text={displayValue} className="copy-button ml-0 shrink-0" tooltipContent="Copy secret" />;
    };

    const renderDisplaySecretEntries = () => {
        if (displaySecretEntries.length === 0) return null;

        return (
            <div className="flex flex-col gap-3">
                {displaySecretEntries.map(([key, value]) => (
                    <div
                        key={key}
                        className="flex flex-col gap-1 rounded-lg border border-border bg-muted/10 px-4 py-3"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <h3 className="text-xs leading-5 font-semibold text-foreground">{key}</h3>
                            {renderSecretCopyButton(value)}
                        </div>
                        {renderSecretValue(value)}
                    </div>
                ))}
            </div>
        );
    };

    const renderSecret = () => (
        <div className="flex flex-col gap-5">
            {renderDisplaySecretEntries()}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xs leading-5 font-semibold text-foreground">JSON View</h3>
                    <CopyButton
                        text={formattedSecret}
                        className="copy-button ml-0 shrink-0"
                        tooltipContent="Copy secrets"
                    />
                </div>
                <pre className="rounded-lg border border-border bg-muted/20 p-4 text-xs leading-5 wrap-break-word whitespace-pre-wrap">
                    {formattedSecret}
                </pre>
            </div>
        </div>
    );

    const renderRetryState = () => (
        <div className="flex flex-col gap-3">
            <p className="text-sm text-destructive">{errorMessage}</p>
            {errorMessage?.includes('Access expired') && (
                <p className="text-sm text-muted-foreground">Send OTP again to continue viewing connection secrets.</p>
            )}
        </div>
    );

    const renderBody = () => {
        if (step === 'requesting-otp') return renderLoadingState('Sending OTP...');
        if (step === 'loading-secret') return renderLoadingState('Loading connection secrets...');
        if (step === 'secret-loaded') return renderSecret();
        if (step === 'token-expired' || step === 'error') return renderRetryState();

        return renderOtpInput();
    };

    const renderPrimaryAction = () => {
        if (step === 'secret-loaded') {
            return <Button onClick={handleClose}>Close</Button>;
        }

        if (step === 'token-expired' || step === 'error') {
            if (errorMessage?.includes('Access expired')) {
                return (
                    <Button
                        onClick={() => {
                            void handleSendOtp();
                        }}
                        disabled={sendOtpMutation.isPending}
                    >
                        Send OTP to View Secrets
                    </Button>
                );
            }

            return null;
        }

        if (step === 'idle' || step === 'requesting-otp' || step === 'loading-secret') {
            return null;
        }

        return (
            <Button
                onClick={() => {
                    void handleVerifyOtp();
                }}
                disabled={otp.length !== 6 || step === 'verifying'}
            >
                {step === 'verifying' ? <SpinnerBlade className="scale-75" /> : null}
                {step === 'verifying' ? 'Verifying...' : 'Verify OTP'}
            </Button>
        );
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) handleClose();
            }}
        >
            <DialogContent className="overflow-hidden p-0 sm:max-w-[560px]">
                <DialogHeader className="flex-row items-center justify-between">
                    <DialogTitle className="font-medium">View Connection Secrets</DialogTitle>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Close View Connection Secrets"
                        onClick={handleClose}
                    >
                        <XIcon />
                    </Button>
                </DialogHeader>
                <DialogBody className="scrollbar-controller scrollbar-vertical max-h-[70svh] overflow-x-hidden py-6">
                    {renderBody()}
                </DialogBody>
                <DialogFooter className="flex-row justify-end gap-3 border-t p-4 sm:justify-end sm:gap-3">
                    {step !== 'secret-loaded' && (
                        <Button variant="secondary" onClick={handleClose}>
                            Cancel
                        </Button>
                    )}
                    {renderPrimaryAction()}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default DataStoresConnectionSecretModal;
