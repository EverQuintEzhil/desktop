import { Input } from '@/components/ui/input';

import FieldErrorMessage from './field-error-message';
import FieldHelp from './field-help';

interface Props {
    label: string;
    value: string | undefined;
    onChange: (value: string) => void;
    description?: string;
    error?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
}

const ConfigTextField = ({ label, value, onChange, description, error, placeholder, disabled, required }: Props) => (
    <div className="flex flex-col gap-1">
        <FieldHelp label={label} description={description} required={required} />
        <Input
            readOnly={disabled}
            isErrored={Boolean(error)}
            value={value ?? ''}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
        />
        <FieldErrorMessage error={error} />
    </div>
);

export default ConfigTextField;
