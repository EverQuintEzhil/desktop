const nin = (arr: unknown, value: unknown) => {
    if (!Array.isArray(arr)) {
        return false;
    }
    if (Array.isArray(value)) {
        return arr.every((v) => value.indexOf(v) === -1);
    }
    if (value) {
        return arr.indexOf(value) === -1;
    }

    return false;
};

export default nin;
