const SomeFn = (arr1: unknown, arr2: unknown) => {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
        return false;
    }
    for (let i = 0; i < arr2.length; i += 1) {
        if (arr1.indexOf(arr2[i]) !== -1) {
            return true;
        }
    }

    return false;
};

export default SomeFn;
