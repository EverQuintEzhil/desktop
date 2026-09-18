import { AlertTriangleIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface Props {
    message: string;
    onRetry: () => void;
}

const RoutinesLoadError = ({ message, onRetry }: Props) => (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 py-16 text-center">
        <AlertTriangleIcon aria-hidden="true" className="size-8 text-destructive" />
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Try again
        </Button>
    </div>
);

export default RoutinesLoadError;
