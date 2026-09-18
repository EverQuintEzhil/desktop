const FormatArray = (value: unknown) => {
    if (!Array.isArray(value)) {
        if (value == null || value == undefined) {
            return [];
        }

        return [value];
    }

    return value;
};

export default FormatArray;
