const isJSON = (data: unknown) => {
    try {
        JSON.parse(data as string);

        return true;
    } catch {
        return false;
    }
};

export default isJSON;
