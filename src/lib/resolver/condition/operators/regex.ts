const ParseRegexString = (s: string) => new RegExp(s.match(/\/(.+)\/.*/)![1], s.match(/\/.+\/(.*)/)![1]);

const regex = (a: unknown, b: unknown) => new RegExp(ParseRegexString(b as string)).test(a as string);

export default regex;
