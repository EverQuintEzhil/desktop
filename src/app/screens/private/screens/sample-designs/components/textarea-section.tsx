import { useState } from 'react';

import TextAreaForm from '@/components/ui/textarea-form';

import { Block, Section } from './shared';

export default function TextareaSection() {
    const [textareaValue, setTextareaValue] = useState('');

    return (
        <Section title="Textarea" description="Multi-line text input">
            <div className="max-w-md space-y-6">
                <Block title="Default">
                    <TextAreaForm value={textareaValue} onChange={setTextareaValue} placeholder="Write something..." />
                </Block>
                <Block title="With max words (50)">
                    <TextAreaForm value="" onChange={() => {}} placeholder="Limited to 50 words..." maxWords={50} />
                </Block>
                <Block title="Error state">
                    <TextAreaForm value="Invalid content" onChange={() => {}} isErrored />
                </Block>
            </div>
        </Section>
    );
}
