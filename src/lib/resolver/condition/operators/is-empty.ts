import { isEmpty } from 'lodash';

const isEmptyFn = (a: unknown) => {
    if (typeof a === 'number') {
        if (a <= 0) {
            return true;
        }

        return false;
    }
    if (typeof a === 'boolean') {
        return !a;
    }
    if (typeof a === 'object' && Array.isArray(a)) {
        return a.length === 0;
    }
    if (typeof a === 'object' && a instanceof Date) {
        return false;
    }

    return isEmpty(a);
};

export default isEmptyFn;
