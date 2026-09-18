export const sanitizeMermaidChart = (chart: string): string =>
    chart
        .replace(/^\s*```+\s*mermaid[^\n]*\n?/i, '')
        .replace(/\n?```+\s*$/g, '')
        .trim();
