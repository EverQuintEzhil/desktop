import { useMutation } from '@tanstack/react-query';

import { apiClient } from '../client';

export const PARAMETERS_SCHEMA_QUERY_KEY = ['admin', 'parameters-schema'] as const;

export const adminParametersSchemaApi = {
    async update<T = unknown>(dataType: string, id: string, data: object): Promise<T> {
        return apiClient.put<T>(`/${dataType}/${id}`, data);
    },
};

export interface ParametersSchemaUpdateVariables {
    dataType: string;
    id: string;
    data: object;
}

export function useParametersSchemaUpdateMutation() {
    return useMutation({
        mutationFn: (vars: ParametersSchemaUpdateVariables) =>
            adminParametersSchemaApi.update(vars.dataType, vars.id, vars.data),
    });
}
