import Resolver from '../../resolver';
import Condition from '../index';

const IF = (data: unknown, options: unknown) => {
    if (Array.isArray(options)) {
        let index = 0;

        for (index = 0; index < options.length - 1; index += 2) {
            const element = options[index];
            const isTruthy = Condition(data, element);

            if (isTruthy) {
                return Resolver(data, options[index + 1]);
            }
        }
        if (options.length === index + 1) {
            return Resolver(data, options[index]);
        }
    }

    return false;
};

export default IF;
