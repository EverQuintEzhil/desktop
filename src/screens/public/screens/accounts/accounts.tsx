import QueryString from 'qs';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useIsDarkMode } from '@/hooks';
import { selectTenant } from '@/store/selectors';

import './accounts.scss';
import { Login } from './components';

const Accounts = () => {
    const tenant = useSelector(selectTenant);
    const isDarkMode = useIsDarkMode();

    useEffect(() => {
        const { redirect_uri: uri = '', redirect_uri_type: type = '' } = QueryString.parse(
            window.location.search.replace('?', ''),
        );

        const value = uri?.toString();

        if (!value) {
            return;
        }

        if (type?.toString().toLowerCase() === 'base64') {
            // atob throws on anything that is not valid base64, and this runs on
            // a URL any unauthenticated visitor can craft.
            try {
                sessionStorage.setItem('deep_link', atob(value));
            } catch (error) {
                // Storing the undecoded value would send the user to a
                // same-origin path built from raw base64, which just 404s.
                console.error('Failed to decode redirect_uri', error);
            }

            return;
        }

        sessionStorage.setItem('deep_link', value);
    }, []);

    useEffect(() => {
        const { documentElement: html, body } = document;
        const prevHtmlOverflow = html.style.overflow;
        const prevBodyOverflow = body.style.overflow;
        const prevBodyMinHeight = body.style.minHeight;

        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        body.style.minHeight = '100dvh';

        return () => {
            html.style.overflow = prevHtmlOverflow;
            body.style.overflow = prevBodyOverflow;
            body.style.minHeight = prevBodyMinHeight;
        };
    }, []);

    return (
        <div className="account-page flex h-dvh max-h-dvh w-full flex-col overflow-hidden px-4 py-6 max-md:py-4">
            <div className="account-inner flex min-h-0 flex-1 flex-col items-center justify-center gap-10 max-md:gap-6">
                <h1 className="logo flex items-center justify-center">
                    <img
                        src={isDarkMode && tenant.logoWhite ? tenant.logoWhite : tenant.logoHorizontal}
                        alt={tenant.name}
                        className="img-responsive"
                    />
                </h1>
                <Routes>
                    <Route path="" element={<Login />} />
                    {/* Desktop signs in through the website only (system browser + deep link); there are no email/OTP or in-app IdP steps. */}
                    <Route path="*" element={<Navigate to="/accounts" />} />
                </Routes>
            </div>
            <div className="copy-rights mt-auto shrink-0 text-center">
                <span className="text-sm font-medium text-primary">
                    Copyright © {new Date().getFullYear()} {tenant?.companyName}. All rights reserved.
                </span>
            </div>
        </div>
    );
};

export default Accounts;
