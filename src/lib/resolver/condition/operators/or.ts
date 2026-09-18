import Condition from '../index';

interface ConditionOptions {
    conditions?: unknown[];
    return?: unknown;
}

const OR = (data: unknown, options: unknown) => {
    const named = options as ConditionOptions;

    if (named.conditions?.some((condition: unknown) => Condition(data, condition))) {
        return named.return || true;
    }
    if (Array.isArray(options)) {
        return options.some((condition: unknown) => Condition(data, condition));
    }

    return false;
};

export default OR;
