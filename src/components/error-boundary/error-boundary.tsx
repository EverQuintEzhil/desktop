import { HouseIcon, RefreshCwIcon, RocketIcon } from 'lucide-react';
import React, { Component, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    getAgentHomePath = (): string | null => {
        const pathname = window.location.pathname;
        const agentMatch = pathname.match(/^\/agent\/([^/]+)/);

        if (agentMatch) {
            return `/agent/${agentMatch[1]}`;
        }

        return null;
    };

    renderHomeButton = () => {
        const agentHomePath = this.getAgentHomePath();

        if (!agentHomePath) {
            return null;
        }

        return (
            <Button
                variant="outline"
                size="lg"
                className="max-sm:w-full max-sm:justify-center"
                onClick={() => {
                    this.setState({ hasError: false, error: undefined });
                    window.location.href = agentHomePath;
                }}
            >
                <HouseIcon />
                Home
            </Button>
        );
    };

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback || (
                    <div className="error-boundary-container mx-auto flex min-h-svh w-full max-w-[880px] flex-col items-center justify-center gap-4 p-4">
                        <h3 className="text-center text-xl font-medium">Something went wrong</h3>
                        <div className="error-boundary-content flex w-full flex-col items-center gap-4 text-center">
                            <span className="text-sm">An error occurred while loading this component.</span>
                            <div className="error-boundary-buttons flex w-full flex-wrap items-center justify-center gap-4 max-sm:flex-col">
                                <Button
                                    size="lg"
                                    className="max-sm:w-full max-sm:justify-center"
                                    onClick={() => {
                                        this.setState({ hasError: false, error: undefined });
                                        window.location.reload();
                                    }}
                                >
                                    <RefreshCwIcon />
                                    Refresh
                                </Button>
                                {this.renderHomeButton()}
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="max-sm:w-full max-sm:justify-center"
                                    onClick={() => {
                                        this.setState({ hasError: false, error: undefined });
                                        window.location.href = '/';
                                    }}
                                >
                                    <RocketIcon />
                                    Launcher
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
