import { useState } from 'react';

import OtpInput from '@/components/ui/input-otp';

import { Block, Section } from './shared';

export default function OtpInputSection() {
    const [otpValue, setOtpValue] = useState('');
    const [otpValue2, setOtpValue2] = useState('');
    const [otpValue3, setOtpValue3] = useState('');

    return (
        <Section title="OTP Input" description="One-time password input">
            <div className="max-w-md space-y-6">
                <Block title="4-digit OTP">
                    <OtpInput numOfInputs={4} value={otpValue} onChange={setOtpValue} />
                </Block>
                <Block title="6-digit OTP (number only)">
                    <OtpInput numOfInputs={6} value={otpValue2} onChange={setOtpValue2} isInputNumber />
                </Block>
                <Block title="With error">
                    <OtpInput
                        numOfInputs={4}
                        value={otpValue3}
                        onChange={setOtpValue3}
                        error={{ state: true, message: 'Invalid OTP code' }}
                    />
                </Block>
            </div>
        </Section>
    );
}
