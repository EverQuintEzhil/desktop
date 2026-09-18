import { cn } from '@/lib/utils';

interface Props {
    values: number[];
    width?: number;
    height?: number;
    className?: string;
}

const buildPoints = (values: number[], width: number, height: number): string => {
    if (values.length < 2) return '';

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const step = width / (values.length - 1);

    return values
        .map((value, index) => `${(index * step).toFixed(1)},${(height - ((value - min) / span) * height).toFixed(1)}`)
        .join(' ');
};

const Sparkline = ({ values, width = 72, height = 22, className }: Props) => {
    const points = buildPoints(values, width, height);

    if (!points) return null;

    return (
        <svg
            className={cn('sparkline', className)}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            fill="none"
            aria-hidden="true"
            focusable="false"
        >
            <polyline points={points} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
        </svg>
    );
};

export default Sparkline;
