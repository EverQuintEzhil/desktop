import { MenuIcon } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { toggleHeader } from '@/store/reducers/header';
import { selectHeader } from '@/store/selectors';

import './header.scss';

interface Props {
    breadcrumbs: {
        title: string;
        to?: string;
        /** Runs before the crumb navigates — for state the destination must not inherit. */
        onClick?: () => void;
    }[];
    /**
     * Control that closes the trail — a scope switcher standing in for the final crumb.
     * Sits inside the list so the `/` separator before it comes from the same rule as
     * every other crumb.
     */
    breadcrumbTrailing?: React.ReactNode;
    /** Sits inside the last crumb, past its label — a control that belongs to the page title. */
    titleTrailing?: React.ReactNode;
    actions?: React.ReactNode;
}

const Header = (props: Props) => {
    const { breadcrumbs, breadcrumbTrailing, titleTrailing, actions } = props;
    const dispatch = useDispatch();
    const header = useSelector(selectHeader);

    const renderBreadcrumbs = () => {
        return breadcrumbs.map((breadcrumb, index) => {
            // A trailing control closes the trail, so the last text crumb is no longer where
            // the user is — it becomes a link back, like any other ancestor crumb.
            const isTerminal = index === breadcrumbs.length - 1 && !breadcrumbTrailing;

            return (
                <li
                    key={breadcrumb.title + breadcrumb.to}
                    className={
                        isTerminal && titleTrailing
                            ? 'breadcrumbs-list-item flex items-center gap-0.5'
                            : 'breadcrumbs-list-item'
                    }
                >
                    {!isTerminal && breadcrumb.to ? (
                        <Link
                            to={breadcrumb.to}
                            aria-label={`Navigate to ${breadcrumb.title}`}
                            onClick={breadcrumb.onClick}
                        >
                            {breadcrumb.title}
                        </Link>
                    ) : (
                        <span className="text-sm">{breadcrumb.title}</span>
                    )}
                    {isTerminal && titleTrailing ? titleTrailing : null}
                </li>
            );
        });
    };

    return (
        <header
            className="page-header sticky top-0 z-10 flex min-h-[49px] w-full items-center gap-2 border-b border-border-secondary bg-card px-4 py-2"
            data-is-open={header.isOpen}
        >
            <Button
                variant="secondary"
                size="icon-sm"
                className="bars-sort rounded-full"
                aria-label="Toggle navigation menu"
                onClick={() => {
                    dispatch(toggleHeader());
                }}
            >
                <MenuIcon />
            </Button>
            <nav aria-label="Breadcrumb navigation" className="breadcrumbs-list flex min-w-0 flex-1 gap-1">
                <ul className="m-0 flex list-none items-center gap-1 p-0">
                    {renderBreadcrumbs()}
                    {breadcrumbTrailing && (
                        <li className="breadcrumbs-list-item breadcrumbs-list-item-control flex items-center">
                            {breadcrumbTrailing}
                        </li>
                    )}
                </ul>
            </nav>
            {actions && <>{actions}</>}
        </header>
    );
};

export default Header;
