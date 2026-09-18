const length = (data: unknown) => {
    if (Array.isArray(data) || typeof data === 'string') {
        return data.length;
    }

    return null;
};

export default length;
