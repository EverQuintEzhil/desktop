import Resolver from '../resolver';

const Base64Encode = (data: unknown, options: unknown): unknown => atob(Resolver(data, options));

export default Base64Encode;
