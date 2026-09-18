import React, { Component, type ReactNode, type ErrorInfo } from 'react';

import './error-boundary.scss';
interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorDisplayProps {
    error: Error | null;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error }) => {
    return (
        <div className="error-boundary flex flex-col items-center justify-center gap-3 p-4 text-center">
            <h3 className="error-boundary-title font-medium">Something went wrong</h3>
            <span className="text-sm">An error occurred while rendering the editor.</span>
            {error && <pre className="error-boundary-message px-3 py-2 text-sm">{error.message}</pre>}
        </div>
    );
};

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return <ErrorDisplay error={this.state.error} />;
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
