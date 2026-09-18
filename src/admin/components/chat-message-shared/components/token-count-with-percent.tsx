export interface TokenCountWithPercentProps {
    value: number;
    percent: number | null;
    showCo2Unit?: boolean;
}

export const Co2TokenUnit = () => (
    <span className="ml-1 font-normal text-text-secondary">
        CO
        <sub>2</sub>e
    </span>
);

export const TokenCountWithPercent = ({ value, percent, showCo2Unit = false }: TokenCountWithPercentProps) => (
    <span className="text-right text-xs font-medium tabular-nums">
        {value.toLocaleString()}
        {showCo2Unit && <Co2TokenUnit />}
        {!showCo2Unit && percent !== null && (
            <span className="ml-1 text-text-secondary">
                ({percent}
                %)
            </span>
        )}
    </span>
);
