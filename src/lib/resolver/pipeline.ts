import PipelineOperations from './pipeline-operations';

const Pipeline = (data: unknown, operations: Record<string, unknown>[]): unknown =>
    operations.reduce((previousValue: unknown, currentValue: Record<string, unknown>) => {
        const [name, operation] = Object.entries(currentValue)[0];
        const operationsByName = PipelineOperations as unknown as Record<
            string,
            (value: unknown, options: unknown, originalData?: unknown) => unknown
        >;

        if (typeof previousValue === 'undefined' || previousValue === null) {
            return null;
        }
        if (!name) {
            return null;
        }
        if (operationsByName[name]) {
            return operationsByName[name](previousValue, operation, data);
        }

        return null;
    }, data);

export default Pipeline;
