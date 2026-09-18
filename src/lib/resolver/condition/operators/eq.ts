import { isEqual } from 'lodash';

const eq = (a: unknown, b: unknown) => {
    if (Array.isArray(a) && !Array.isArray(b)) {
        return a.indexOf(b) !== -1;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.every((v) => a.indexOf(v) !== -1);
    }

    return isEqual(a, b);
};

export default eq;
