import isEmpty from 'lodash/isEmpty';

const isNotEmpty = (a: unknown) => {
    if (typeof a !== 'undefined') {
        if (typeof a === 'number') {
            if (a <= 0) {
                return false;
            }

            return true;
        }
        if (typeof a === 'boolean') {
            return a;
        }
        if (typeof a === 'object' && Array.isArray(a)) {
            return a.length > 0;
        }
        if (typeof a === 'object' && a instanceof Date) {
            return true;
        }

        return !isEmpty(a);
    }

    return false;
};

export default isNotEmpty;
