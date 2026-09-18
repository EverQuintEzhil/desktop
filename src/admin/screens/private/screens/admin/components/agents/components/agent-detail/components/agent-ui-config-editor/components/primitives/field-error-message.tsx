interface Props {
    error?: string;
}

const FieldErrorMessage = ({ error }: Props) => {
    if (!error) {
        return null;
    }

    return <span className="text-xs text-(--danger)">{error}</span>;
};

export default FieldErrorMessage;
