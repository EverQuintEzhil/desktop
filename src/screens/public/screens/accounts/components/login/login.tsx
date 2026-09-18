import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import { setSessionToken } from '@/lib/auth/session-token';
import {
    buildWebsiteLoginUrl,
    clearStoredLoginState,
    createLoginState,
    parseWebsiteCallback,
    readStoredLoginState,
    storeLoginState,
} from '@/lib/auth/website-login';
import { selectTenant } from '@/store/selectors';

import Success from '../success';

/**
 * Desktop signs in through the WEBSITE only. The IdP cookie flow cannot run
 * inside the Tauri webview (tauri://localhost never sees the web origin's
 * httpOnly cookie), so the app opens `<website>/desktop-auth` in the system
 * browser, the user signs in there, and the website hands the bearer session
 * back through the `fluentmind-desktop://auth` deep link
 * (see `lib/auth/website-login.ts` for the contract).
 */

type LoginStatus = 'idle' | 'waiting' | 'success';

/** Opens the URL in the SYSTEM browser; falls back to window.open outside Tauri (dev in a plain browser). */
const openInSystemBrowser = async (url: string): Promise<void> => {
    try {
        const { openUrl } = await import('@tauri-apps/plugin-opener');

        await openUrl(url);
    } catch (error) {
        console.error('Opener plugin unavailable, falling back to window.open', error);
        window.open(url, '_blank', 'noopener,noreferrer');
    }
};

const Login = () => {
    const tenant = useSelector(selectTenant);

    const [status, setStatus] = useState<LoginStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    // The deep link can arrive while React state is mid-update; a ref keeps the
    // handler idempotent so a duplicate OS event cannot store two sessions.
    const completedRef = useRef(false);
    // Port of the 127.0.0.1 loopback listener (src-tauri/auth_server.rs). The
    // custom scheme is only registered for BUNDLED macOS builds, so the website
    // delivers the token to this port first and the scheme stays a fallback.
    const loopbackPortRef = useRef<number | null>(null);

    const completeFromDeepLink = (urls: string[]) => {
        if (completedRef.current) {
            return;
        }

        const callback = urls.map(parseWebsiteCallback).find((parsed) => parsed !== null);

        if (!callback) {
            return;
        }

        const expectedState = readStoredLoginState();

        // A callback that does not echo the nonce this app generated is not an
        // answer to a sign-in this app started — never store its token.
        if (!expectedState || callback.state !== expectedState) {
            console.error('Ignoring desktop sign-in callback with an unexpected state');
            setError('That sign-in link could not be verified. Please start again from this screen.');
            setStatus('idle');

            return;
        }

        completedRef.current = true;
        clearStoredLoginState();

        // Stored before Success mounts, because Success immediately fetches
        // userinfo with it.
        setSessionToken(callback.token, callback.expiresAt);
        setError(null);
        setStatus('success');
    };

    useEffect(() => {
        let unlisten: (() => void) | undefined;
        let unlistenLoopback: (() => void) | undefined;
        let stopServer: (() => void) | undefined;
        let unmounted = false;

        const subscribe = async () => {
            try {
                // Resolved lazily: outside Tauri (browser dev, tests) the plugin
                // has no host to talk to and this simply stays unsubscribed.
                const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
                const stop = await onOpenUrl((urls) => completeFromDeepLink(urls));

                if (unmounted) {
                    stop();
                } else {
                    unlisten = stop;
                }
            } catch {
                // Not running inside the Tauri shell — the button below still
                // opens the website; only the automatic hand-back is unavailable.
            }

            try {
                // Loopback fallback (src-tauri/auth_server.rs): the deep link
                // cannot come back in a macOS dev build, so the website delivers
                // the same callback URL to 127.0.0.1 and Rust re-emits it here.
                const { invoke } = await import('@tauri-apps/api/core');
                const { listen } = await import('@tauri-apps/api/event');

                const port = await invoke<number>('start_desktop_auth_server');
                const stopListening = await listen<string>('desktop-auth-callback', (event) =>
                    completeFromDeepLink([event.payload]),
                );

                if (unmounted) {
                    stopListening();
                    void invoke('stop_desktop_auth_server');
                } else {
                    loopbackPortRef.current = port;
                    unlistenLoopback = stopListening;
                    stopServer = () => void invoke('stop_desktop_auth_server');
                }
            } catch {
                // Outside the Tauri shell, or the port could not be bound — the
                // deep link path above still works for bundled builds.
            }
        };

        void subscribe();

        return () => {
            unmounted = true;
            unlisten?.();
            unlistenLoopback?.();
            stopServer?.();
        };
    }, []);

    const onSignIn = async () => {
        const state = createLoginState();

        storeLoginState(state);
        setError(null);
        setStatus('waiting');

        await openInSystemBrowser(buildWebsiteLoginUrl(state, loopbackPortRef.current ?? undefined));
    };

    if (status === 'success') {
        return <Success />;
    }

    if (status === 'waiting') {
        return (
            <div className="signin-block flex flex-col items-center justify-center gap-6">
                <Spinner className="scale-[1.5]" role="status" aria-label="Waiting for browser sign-in" />
                <div aria-live="polite" className="flex flex-col items-center gap-1 text-center">
                    <h3 className="font-medium">Finish signing in from your browser</h3>
                    <span className="text-muted-foreground max-w-sm text-sm">
                        We opened {tenant?.name ? `the ${tenant.name} website` : 'your browser'}. Sign in there and
                        you&apos;ll be brought straight back here.
                    </span>
                </div>
                <div className="login-buttons flex flex-col items-center gap-3">
                    <Button
                        variant="outline"
                        className="justify-center rounded-md px-3 py-2 text-center font-medium"
                        onClick={() => void onSignIn()}
                    >
                        Open the browser again
                    </Button>
                    <Button variant="link" onClick={() => setStatus('idle')}>
                        Cancel
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="signin-block flex flex-col items-center justify-center">
            <h3 className="text-center">{tenant?.loginText}</h3>
            <div className="login-buttons flex flex-col gap-6">
                <Button
                    className="sign-in-website justify-center rounded-md px-3 py-2 text-center font-medium"
                    onClick={() => void onSignIn()}
                >
                    Sign in with website
                </Button>
            </div>
            <span className="text-muted-foreground mt-4 max-w-sm text-center text-sm">
                You&apos;ll sign in securely in your browser and return here automatically.
            </span>
            {error && (
                <p role="alert" className="text-destructive mt-4 max-w-sm text-center text-sm">
                    {error}
                </p>
            )}
        </div>
    );
};

export default Login;
