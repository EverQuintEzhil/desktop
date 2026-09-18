import Spinner from '@/components/ui/spinner';

const PromptDetailLoading = () => {
    return (
        <div className="loading-spinner flex min-h-svh w-full items-center justify-center">
            <div className="spinner-inner flex flex-col items-center justify-center gap-4">
                <Spinner className="scale-[1.5]" />
                <div className="text-center">
                    <h3 className="mb-1 text-sm font-medium">Loading Prompt Details</h3>
                    <span className="text-sm text-text-secondary">Fetching information...</span>
                </div>
            </div>
        </div>
    );
};

export default PromptDetailLoading;
