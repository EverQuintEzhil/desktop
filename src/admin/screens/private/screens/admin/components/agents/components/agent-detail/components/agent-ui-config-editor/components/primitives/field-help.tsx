import { InfoIcon } from 'lucide-react';

import { SimpleTooltip } from '@/components/ui/simple-tooltip';

interface Props {
    label: string;
    description?: string;
    required?: boolean;
    className?: string;
}

const FieldHelp = ({ label, description, required, className }: Props) => {
    const renderRequired = () => {
        if (!required) return null;

        return <span className="ml-0.5 text-(--danger)">*</span>;
    };

    const renderDescription = () => {
        if (!description) return null;

        return (
            <SimpleTooltip content={description} side="bottom">
                <span className="ml-1 text-text-secondary">
                    <InfoIcon className="size-4" />
                </span>
            </SimpleTooltip>
        );
    };

    return (
        <div className={`flex items-center gap-1 text-sm font-medium ${className ?? ''}`}>
            <span>
                {label}
                {renderRequired()}
            </span>
            {renderDescription()}
        </div>
    );
};

export default FieldHelp;
