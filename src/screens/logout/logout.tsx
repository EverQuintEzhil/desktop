import { AlertTriangleIcon, LogOutIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Spinner from '@/components/ui/spinner';
import { authApi, sessionApi } from '@/lib/api';
import { createAnonymousUserState } from '@/lib/auth/user-state';
import { mapTenantPublicToTenant } from '@/lib/tenant/tenant-state';
import { setTenant } from '@/store/reducers/tenant';
import { setUser } from '@/store/reducers/user';

import './logout.scss';

const Logout = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchTenant = async () => {
        try {
            setLoading(true);
            const details = await sessionApi.getPublic();

            dispatch(setTenant(mapTenantPublicToTenant(details)));
            document.title = `${details?.name} \u00B7  ${details?.description}`;
            localStorage.setItem('tenant', JSON.stringify(details));
            setLoading(false);
        } catch (error) {
            console.error(error);
        }
    };

    const logout = async () => {
        try {
            setLoading(true);
            setError(false);
            await authApi.logout();
            sessionStorage.clear();
            localStorage.removeItem('user');
            localStorage.removeItem('tenant');
            dispatch(setUser(createAnonymousUserState()));
            fetchTenant();
            navigate('/');
        } catch (error) {
            console.error(error);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    const handleRetry = async () => {
        await logout();
        window.location.reload();
    };

    useEffect(() => {
        logout();
    }, []);

    if (loading) {
        return (
            <main className="logout-screen viewport-height flex items-center justify-center overflow-hidden p-4">
                <Card className="logout-card z-10 flex w-full max-w-[440px] flex-col gap-6 border-border/70 bg-card/95 px-2 py-12 text-center shadow-none!">
                    <CardHeader className="flex flex-col items-center px-6 text-center">
                        <CardTitle className="text-xl leading-tight">Signing you out</CardTitle>
                        <CardDescription className="max-w-xs text-center text-sm leading-6">
                            We&apos;re securely ending your session and preparing the sign-in experience.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-4 px-6">
                        <div className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                            <Spinner className="size-4 text-primary" />
                            <span>Clearing session data</span>
                        </div>
                        <div className="logout-progress h-1.5 w-full max-w-[280px] overflow-hidden rounded-full bg-muted">
                            <div className="logout-progress-bar h-full rounded-full" />
                        </div>
                    </CardContent>
                </Card>
            </main>
        );
    }
    if (error) {
        return (
            <main className="logout-screen viewport-height flex items-center justify-center overflow-hidden p-4">
                <div className="logout-screen-accent logout-screen-accent-primary size-[280px] rounded-full" />
                <div className="logout-screen-accent logout-screen-accent-secondary size-[220px] rounded-full" />

                <Card className="logout-card z-10 w-full max-w-[440px] border-border/70 bg-card/95 px-2 py-8 text-center">
                    <CardHeader className="flex flex-col items-center px-6 text-center">
                        <div className="logout-icon-shell logout-icon-shell-error flex size-14 items-center justify-center rounded-2xl">
                            <AlertTriangleIcon className="size-6" aria-hidden="true" />
                        </div>
                        <CardTitle className="text-xl leading-tight">We couldn&apos;t sign you out</CardTitle>
                        <CardDescription className="max-w-xs text-center text-sm leading-6">
                            Your session may still be active. Try again to finish signing out securely.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="justify-center px-6">
                        <Button type="button" onClick={handleRetry}>
                            <LogOutIcon className="size-4" aria-hidden="true" />
                            Try again
                        </Button>
                    </CardFooter>
                </Card>
            </main>
        );
    }

    return <></>;
};

export default Logout;
