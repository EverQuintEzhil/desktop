import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Skeleton } from '@/components/ui/skeleton';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { TruncatedLabel } from '@/components/ui/truncated-label';
import { adminMemoriesApi } from '@/lib/api/admin/memories';

const memoryPreferenceKey = (memoryId: string) => ['memory-preference', memoryId];

interface MemoryPreferenceRowProps {
    memoryId: string;
    memoryName: string;
}

const MemoryPreferenceRow = ({ memoryId, memoryName }: MemoryPreferenceRowProps) => {
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: memoryPreferenceKey(memoryId),
        queryFn: () => adminMemoriesApi.getPreference(memoryId),
    });

    const isRemembering = !data?.disabled;

    const toggleMutation = useMutation({
        mutationFn: (disabled: boolean) => adminMemoriesApi.setPreference(memoryId, { disabled }),
        onMutate: async (disabled) => {
            await queryClient.cancelQueries({ queryKey: memoryPreferenceKey(memoryId) });
            const previous = queryClient.getQueryData<{ disabled: boolean }>(memoryPreferenceKey(memoryId));

            queryClient.setQueryData(memoryPreferenceKey(memoryId), { disabled });

            return { previous };
        },
        onError: (_err, _vars, context) => {
            queryClient.setQueryData(memoryPreferenceKey(memoryId), context?.previous);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: memoryPreferenceKey(memoryId) });
        },
    });

    const toggle = () => toggleMutation.mutate(isRemembering);

    return (
        <div className="memory-preference-row flex items-center justify-between gap-3">
            <TruncatedLabel text={memoryName} className="text-sm" />
            <div className="flex shrink-0 items-center gap-2">
                {isLoading ? (
                    <Skeleton className="h-5 w-9 rounded-full" />
                ) : (
                    <ToggleSwitch
                        checked={isRemembering}
                        disabled={toggleMutation.isPending}
                        onCheckedChange={toggle}
                        aria-label={`Toggle remembering for ${memoryName}`}
                    />
                )}
            </div>
        </div>
    );
};

export default MemoryPreferenceRow;
