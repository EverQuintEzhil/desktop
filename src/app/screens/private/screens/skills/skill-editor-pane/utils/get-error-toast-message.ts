export const getErrorToastMessage = (error: unknown, fallback: string) => {
    const axiosError = error as { response?: { data?: { message?: string }; status?: number } };

    if (axiosError.response?.status === 500) {
        return 'Internal server error, Please try again.';
    }

    return axiosError.response?.data?.message || (error instanceof Error ? error.message : fallback);
};
