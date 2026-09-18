import { ArrowLeftIcon } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useTenantLogo } from '@/hooks';
import { selectTenant } from '@/store/selectors';

import GlobalLibrary from './global-library';

const LibraryPage = () => {
    const navigate = useNavigate();
    const tenant = useSelector(selectTenant);
    const tenantLogo = useTenantLogo();

    const goHome = () => navigate('/');

    return (
        <div className="flex min-h-svh w-full flex-col bg-background">
            <header className="flex items-center gap-3 border-b px-4 py-3">
                <Button
                    variant="secondary"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label="Back to home"
                    onClick={goHome}
                >
                    <ArrowLeftIcon />
                </Button>
                <img
                    src={tenantLogo}
                    alt={tenant.name}
                    className="h-6 w-auto cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={goHome}
                    onKeyDown={(e) => e.key === 'Enter' && goHome()}
                />
            </header>
            <div className="flex-1">
                <GlobalLibrary basePath="/library" contentClassName="flex flex-col mx-auto px-4 pb-4 w-full relative" />
            </div>
        </div>
    );
};

export default LibraryPage;
