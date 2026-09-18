import { GetByPath, IsInvalid } from './helpers';
import Resolver from './resolver';

const concatRegex = /`(.*?)`/g;

const ResolveStringPath = (data: unknown, string: string, destructure: boolean = true): unknown => {
    if (string.indexOf('`$data') === -1) {
        if (string.indexOf('$data.') === 0) {
            return GetByPath(data, string.replace('$data.', ''), destructure);
        }

        return string;
    }
    const matches = string.match(concatRegex) as RegExpMatchArray;
    const values = matches.map(
        (match: string) =>
            match === '`$data`' ? data : GetByPath(data, match.replace('$data.', '').replace(/`/gi, '')),
        destructure,
    );

    for (let i = 0; i <= matches.length; i += 1) {
        string = string.replace(matches[i], (IsInvalid(values[i]) ? matches[i] : values[i]) as string);
    }
    if (string && string.indexOf('$data.') !== -1 && string.indexOf('`$data') === -1) {
        return Resolver(data, string);
    }

    return string || '';
};

export default ResolveStringPath;
