import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { BrowserRouter as Router } from 'react-router-dom';

import AppIntegrations from '@/components/app-integrations/app-integrations';
import AuthWrapper from '@/components/auth-wrapper';
import ErrorBoundary from '@/components/error-boundary';
import LocalToolApprovalDialog from '@/components/local-tool-approval-dialog';
import ThemeWrapper from '@/components/theme-wrapper';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAppSelector } from '@/hooks';
import Public from '@/screens/public';
import { selectUser } from '@/store/selectors';

import { store } from '../store';

import Private from './screens/private';

const App = () => {
    const user = useAppSelector(selectUser);

    return <Router>{user.isAuthenticated ? <Private /> : <Public />}</Router>;
};

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: 1,
        },
    },
});

function AppWrapper() {
    return (
        <Provider store={store}>
            <QueryClientProvider client={queryClient}>
                <ThemeWrapper>
                    <TooltipProvider>
                        <ErrorBoundary>
                            <AuthWrapper>
                                <AppIntegrations />
                                <App />
                            </AuthWrapper>
                        </ErrorBoundary>
                        <Toaster
                            position="top-right"
                            closeButton
                            expand={true}
                            visibleToasts={Infinity}
                            style={{ top: 'var(--toast-top, 68px)', zIndex: 999 }}
                        />
                        {/* Approves/denies local coding tool grants (desktop spaces with a folder path). */}
                        <LocalToolApprovalDialog />
                    </TooltipProvider>
                </ThemeWrapper>
            </QueryClientProvider>
        </Provider>
    );
}

export default AppWrapper;
