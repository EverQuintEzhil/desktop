import type { MermaidConfig } from 'mermaid';

export const ZOOM_MIN = 0.15;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.25;
export const DEFAULT_ZOOM = 1;
export const MERMAID_CONFIG: MermaidConfig = {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'default',
    htmlLabels: false,
};
