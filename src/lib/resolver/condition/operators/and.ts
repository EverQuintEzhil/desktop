import Condition from '../index';

interface ConditionOptions {
    conditions?: unknown[];
    return?: unknown;
}

const AND = (data: unknown, options: unknown) => {
    const named = options as ConditionOptions;

    if (named.conditions?.every((condition: unknown) => Condition(data, condition))) {
        return named.return || true;
    }
    if (Array.isArray(options)) {
        return options.every((condition: unknown) => Condition(data, condition));
    }

    return false;
};

export default AND;
