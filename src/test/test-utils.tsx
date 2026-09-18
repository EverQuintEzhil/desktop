import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, type RenderHookOptions, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';

import { TooltipProvider } from '@/components/ui/tooltip';
import rootReducer from '@/store/reducers';
import type { RootState } from '@/types/store';

import { authenticatedUser, testTenant } from './fixtures/auth';

type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
    preloadedState?: DeepPartial<RootState>;
    route?: string;
    routerProps?: Omit<MemoryRouterProps, 'children'>;
}

const createTestStore = (preloadedState?: DeepPartial<RootState>) =>
    configureStore({
        reducer: rootReducer,
        preloadedState: {
            user: authenticatedUser,
            tenant: testTenant,
            ...preloadedState,
        } as Partial<RootState>,
    });

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
            },
            mutations: {
                retry: false,
            },
        },
    });

const createWrapper = ({ preloadedState, route = '/', routerProps }: RenderWithProvidersOptions) => {
    const store = createTestStore(preloadedState);
    const queryClient = createTestQueryClient();
    const initialEntries = routerProps?.initialEntries ?? [route];

    const Wrapper = ({ children }: { children: ReactNode }) => (
        <Provider store={store}>
            <QueryClientProvider client={queryClient}>
                <TooltipProvider>
                    <MemoryRouter {...routerProps} initialEntries={initialEntries}>
                        {children}
                    </MemoryRouter>
                </TooltipProvider>
            </QueryClientProvider>
        </Provider>
    );

    return { store, queryClient, Wrapper };
};

/** `renderHook` behind the same provider stack as `renderWithProviders`. */
export const renderHookWithProviders = <TProps, TResult>(
    hook: (props: TProps) => TResult,
    {
        preloadedState,
        route = '/',
        routerProps,
        ...hookOptions
    }: RenderWithProvidersOptions & Omit<RenderHookOptions<TProps>, 'wrapper'> = {},
) => {
    const { store, queryClient, Wrapper } = createWrapper({ preloadedState, route, routerProps });

    return {
        store,
        queryClient,
        ...renderHook(hook, { wrapper: Wrapper, ...hookOptions } as RenderHookOptions<TProps>),
    };
};

export const renderWithProviders = (
    ui: ReactElement,
    { preloadedState, route = '/', routerProps, ...renderOptions }: RenderWithProvidersOptions = {},
) => {
    const { store, queryClient, Wrapper } = createWrapper({ preloadedState, route, routerProps });

    return {
        store,
        queryClient,
        ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    };
};

export * from '@testing-library/react';
