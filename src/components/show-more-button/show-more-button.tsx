import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface ShowMoreButtonProps {
    hasMore: boolean;
    isLoading: boolean;
    onClick: () => void;
    label?: string;
    className?: string;
}

const ShowMoreButton = ({ hasMore, isLoading, onClick, label, className }: ShowMoreButtonProps) => {
    if (!hasMore) {
        return null;
    }

    const renderContent = () => {
        if (isLoading) {
            return (
                <>
                    <Spinner />
                    Loading…
                </>
            );
        }

        return label ?? 'Show more';
    };

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isLoading}
            onClick={() => onClick()}
            className={cn('w-full justify-center text-text-secondary', className)}
        >
            {renderContent()}
        </Button>
    );
};

export default ShowMoreButton;
