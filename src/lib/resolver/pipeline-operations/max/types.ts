const Types = {
    date: (arr: unknown[]) =>
        new Date(Math.max.apply(null, arr.map((date) => new Date(date as string)) as unknown as number[])),
};

export default Types;
