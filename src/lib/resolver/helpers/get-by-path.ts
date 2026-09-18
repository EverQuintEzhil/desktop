import { flattenDeep } from 'lodash';

function IsPositivWholeNumber(value: string) {
    return /^\d+$/.test(value);
}

const GetByPath = (data: unknown, path: string, destructure: boolean = true): unknown =>
    path.split('.').reduce<unknown>((perviousValue, currentValue) => {
        try {
            if (!perviousValue) {
                return null;
            }
            if (currentValue.indexOf('[') !== -1) {
                currentValue = currentValue.replace(/\[/g, '.').replace(/\]/g, '');

                return GetByPath(perviousValue, currentValue);
            }
            if (Array.isArray(perviousValue) && !IsPositivWholeNumber(currentValue) && destructure) {
                return flattenDeep(perviousValue.map((v) => (v as Record<string, unknown>)[currentValue]));
            }

            return (perviousValue as Record<string, unknown>)[currentValue];
        } catch {
            return null;
        }
    }, data);

export default GetByPath;
