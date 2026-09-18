const isValidValue = (a: unknown) => {
    if (a === null || a === undefined) {
        return false;
    }
    switch (typeof a) {
        case 'object': {
            if (Object.prototype.toString.call(a) === '[object Date]') {
                return true;
            }
            if (Array.isArray(a)) {
                return a.length > 0;
            }

            return Object.keys(a).length > 0;
        }
        case 'undefined': {
            return false;
        }
        case 'string': {
            return a.trim() !== '';
        }
        default: {
            return a !== '';
        }
    }
};

export default isValidValue;
