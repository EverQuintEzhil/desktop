import type { z } from 'zod';

import { RadioGroup } from '@/components/ui/radio-group';

import type { librarySchema } from '../../schema';

type Value = z.infer<typeof librarySchema> | undefined;

interface Props {
    value: Value;
    onChange: (next: Value) => void;
    disabled?: boolean;
}

type Mode = 'off' | 'on';

const resolveMode = (value: Value): Mode => {
    if (value === undefined) return 'off';
    if (typeof value === 'boolean') return value ? 'on' : 'off';

    return 'on';
};

const LibraryToggle = ({ value, onChange, disabled }: Props) => {
    const mode = resolveMode(value);

    const handleModeChange = (next: string) => {
        if (disabled) return;

        onChange(next === 'on' ? true : undefined);
    };

    return (
        <RadioGroup
            orientation="horizontal"
            gap="16px"
            checked={mode}
            disabled={disabled}
            onChange={handleModeChange}
            options={[
                { name: 'library-mode', value: 'off', label: 'Off' },
                { name: 'library-mode', value: 'on', label: 'On' },
            ]}
        />
    );
};

export default LibraryToggle;
