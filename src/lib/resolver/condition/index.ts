import Resolver from '../resolver';

import Operators from './operators';

const textKeyOps = ['if', 'or', 'and'];
const doubleParamOps = ['==', '===', '!=', '!==', '>', '<', '>=', '<=', '%'];

interface ConditionOptions {
    operator?: string;
    values?: unknown[];
    return?: unknown;
}

const Condition = (data: unknown, options: unknown): any => {
    const operators = Operators as unknown as Record<string, (...values: unknown[]) => unknown>;

    if (Array.isArray(options)) {
        let value: unknown = null;
        let elseReturn: unknown = false;

        for (let i = 0; i < options.length; i += 1) {
            if ((options[i] as ConditionOptions)?.operator) {
                value = Condition(data, options[i]);
                if (value) {
                    break;
                }
            } else {
                elseReturn = options[i];
            }
        }

        return value || elseReturn;
    }
    const named = options as ConditionOptions;

    if (named?.operator && operators[named.operator]) {
        if (named.values) {
            if (operators[named.operator](...Resolver(data, named.values))) {
                return named.return !== undefined ? named.return : true;
            }
        } else {
            return operators[named.operator](data, options);
        }
    }
    if (typeof options === 'object' && options !== null && !Array.isArray(options)) {
        const conditions = Object.entries(options);

        for (let index = 0; index < conditions.length; index += 1) {
            const [key, value] = conditions[index];

            if (operators[key]) {
                if (textKeyOps.includes(key)) {
                    return operators[key](data, value);
                }
                if (doubleParamOps.includes(key)) {
                    const pair = value as unknown[];
                    let val1 = Resolver(data, pair[0]);
                    let val2 = Resolver(data, pair[1]);

                    val1 = Condition(data, val1);
                    val2 = Condition(data, val2);

                    return operators[key](val1, val2);
                }

                return operators[key](...Resolver(data, value));
            }
        }
    }
    if (typeof options !== 'object') {
        return options;
    }

    return false;
};

export default Condition;
