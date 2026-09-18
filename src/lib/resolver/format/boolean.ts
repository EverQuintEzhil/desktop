const FormatBoolean = (value: unknown) => {
    if (value === 'false') {
        return false;
    }
    if (value === 'true') {
        return true;
    }

    return Boolean(value);
};

export default FormatBoolean;
