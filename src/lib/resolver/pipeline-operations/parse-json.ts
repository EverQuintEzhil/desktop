const parseJSON = (data: unknown): unknown => JSON.parse((data as string) || '{}');

export default parseJSON;
