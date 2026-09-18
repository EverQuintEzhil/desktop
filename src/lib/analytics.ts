export type AnalyticsEventProperties = Record<string, unknown>;

export type AnalyticsTracker = (event: string, properties?: AnalyticsEventProperties) => void;

let tracker: AnalyticsTracker | null = null;

/**
 * Hands the app's analytics client to every feature that raises an event. The features live in
 * the graph `packages/chat-ui-sdk` publishes, and that bundle inlines its whole dependency tree,
 * so importing a vendor SDK here would ship it to embedders who never initialise it. Nothing is
 * registered until the app shell does it, which is why an embedded chat is silent by design.
 */
export const setAnalyticsTracker = (next: AnalyticsTracker | null): void => {
    tracker = next;
};

/** Emitting is never worth breaking the feature that emitted, so a failure is logged. */
export const trackEvent = (event: string, properties?: AnalyticsEventProperties): void => {
    try {
        tracker?.(event, properties);
    } catch (error) {
        console.error(`Failed to track ${event}`, error);
    }
};
