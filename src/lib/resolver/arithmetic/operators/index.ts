const Arithmetic = {
    '+': (...arr: number[]) => arr.reduce((a, c) => a + c, 0),
    '-': (...arr: number[]) => {
        if (arr.length === 1) {
            return -arr[0];
        }
        if (arr.length === 2) {
            return arr[0] - arr[1];
        }

        return null;
    },
    '*': (...arr: number[]) => arr.reduce((a, c) => a * c, 1),
    '/': (...arr: number[]) => {
        if (arr.length === 2) {
            return arr[0] / arr[1];
        }

        return null;
    },
    '%': (...arr: number[]) => {
        if (arr.length === 2) {
            return arr[0] % arr[1];
        }

        return null;
    },
};

export default Arithmetic;
