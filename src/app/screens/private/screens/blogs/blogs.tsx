import { ArrowLeftIcon, LibraryBigIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';

import BlogCollectionsNav from '@/app/components/blog-collections-nav';
import { useBlogQuery } from '@/app/hooks/use-blog-query';
import { AvatarMenu } from '@/components';
import { Button } from '@/components/ui/button';
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAppSelector } from '@/hooks';
import { cn } from '@/lib/utils';
import { selectTenant } from '@/store/selectors';
import { resolveCategoryTag } from '@/utils/resolve-category-tag';

import { HELP_CENTER_PATH, ANNOUNCEMENTS_PATH } from './constants';
import './blogs.scss';

const LOGO_CLASS = 'h-8 max-w-[150px] object-contain object-left';

const LOGO_SWAP_CLASS =
    'relative right-0 transition-[right] duration-200 lg:group-hover:right-full lg:group-focus-visible:right-full';

const Blogs = () => {
    const location = useLocation();
    const { pathname } = location;
    const { blogPostId, categoryId } = useParams();
    const tenant = useAppSelector(selectTenant);
    const [isNavOpen, setIsNavOpen] = useState(false);
    const lastCategoryIdRef = useRef<string | null>(null);

    const isPost = Boolean(blogPostId);
    const isHelpCenter = pathname.startsWith(HELP_CENTER_PATH);

    const { data: post } = useBlogQuery(blogPostId);

    const postCategory = resolveCategoryTag(post);
    const resolvedCategoryId = categoryId ?? postCategory?._id ?? null;

    if (resolvedCategoryId) {
        lastCategoryIdRef.current = resolvedCategoryId;
    }

    const activeCategoryId = resolvedCategoryId ?? (isPost && !post ? lastCategoryIdRef.current : null);

    // HTML posts were authored against a full-bleed wrapper and break in the text column.
    const isWidePost = isPost && post?.contentType === 'html';

    useEffect(() => {
        setIsNavOpen(false);
    }, [pathname]);

    const showRail = !isWidePost && isHelpCenter;

    const renderRail = (onNavigate?: () => void, className?: string) => (
        <BlogCollectionsNav
            className={className}
            activeCategoryId={activeCategoryId}
            activeArticleSlug={blogPostId ?? null}
            onNavigate={onNavigate}
        />
    );

    const renderMobileNav = () => (
        <Sheet open={isNavOpen} onOpenChange={setIsNavOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="blogs-nav-trigger self-start rounded-full lg:hidden">
                    <LibraryBigIcon />
                    Browse collections
                </Button>
            </SheetTrigger>
            <SheetContent
                side="left"
                className="w-[300px] border-none bg-sidebar text-sidebar-foreground sm:max-w-[300px]"
            >
                <SheetHeader className="border-sidebar-foreground/20">
                    <SheetTitle className="text-sidebar-foreground">Browse collections</SheetTitle>
                </SheetHeader>
                <SheetBody className="scrollbar-controller scrollbar-vertical px-1.5">
                    {renderRail(() => setIsNavOpen(false))}
                </SheetBody>
            </SheetContent>
        </Sheet>
    );

    return (
        <div className="blog-page min-h-svh bg-background">
            <header
                className={cn(
                    'blogs-header sticky top-0 z-1 grid h-(--blogs-header-height) grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-border bg-background',
                    // Phones drop the title to its own row under the logo and the actions.
                    'max-sm:h-auto max-sm:grid-cols-[1fr_auto] max-sm:gap-y-0',
                    // The rail takes the first column so the title centres over the content pane.
                    showRail && 'lg:grid-cols-[var(--blogs-rail-width)_1fr_auto_1fr]',
                )}
            >
                <Link
                    to="/"
                    aria-label="Back to home"
                    title="Back to home"
                    className={cn(
                        'blogs-header-brand flex h-full min-w-0 items-center self-start justify-self-start px-6 max-sm:min-h-(--blogs-header-height) max-sm:px-4',
                        // One pixel taller than the header so the sidebar-coloured block runs into the
                        // rail below it instead of showing the header's border as a seam.
                        showRail && 'group lg:h-[calc(100%+1px)] lg:w-full lg:bg-sidebar',
                    )}
                >
                    {/* Mirrors the chat rail's brand slot: the logo slides out of the clipped slot to the
                        left while the back arrow slides in from the right and takes its place. */}
                    <span className="blogs-header-brand-slot relative flex items-center overflow-hidden">
                        <img
                            className={cn(LOGO_CLASS, showRail && 'lg:hidden')}
                            src={tenant.logoHorizontal !== '' ? tenant.logoHorizontal : tenant.logoWhite}
                            alt={tenant.name}
                        />
                        {showRail ? (
                            <>
                                <img
                                    className={cn(LOGO_CLASS, LOGO_SWAP_CLASS, 'hidden lg:block')}
                                    src={tenant.logoWhite !== '' ? tenant.logoWhite : tenant.logoHorizontal}
                                    alt={tenant.name}
                                />
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'blogs-header-brand-back absolute top-1/2 -right-8 hidden size-8 -translate-y-1/2 items-center justify-center text-sidebar-foreground opacity-0 transition-all duration-200 lg:flex',
                                        'group-hover:right-0 group-hover:opacity-100 group-focus-visible:right-0 group-focus-visible:opacity-100',
                                    )}
                                >
                                    <ArrowLeftIcon className="size-4" />
                                </span>
                            </>
                        ) : null}
                    </span>
                </Link>
                {showRail ? <span className="blogs-header-spacer hidden lg:block" aria-hidden="true" /> : null}
                <p className="blogs-header-title min-w-0 truncate text-h3 font-semibold text-(--text-primary) max-sm:col-span-2 max-sm:row-start-2 max-sm:px-4 max-sm:pb-3">
                    {tenant.name} {isHelpCenter ? 'Help Center' : 'Announcements'}
                </p>
                <div className="blogs-header-actions flex items-center justify-end gap-4 pr-6 max-sm:pr-4">
                    <Link
                        to={isHelpCenter ? ANNOUNCEMENTS_PATH : HELP_CENTER_PATH}
                        className="text-sm font-medium text-text-secondary! hover:text-primary! max-sm:hidden"
                    >
                        {isHelpCenter ? 'Announcements' : 'Help Center'}
                    </Link>
                    <AvatarMenu />
                </div>
            </header>
            <main
                className={cn(
                    'blogs-body grid items-start',
                    showRail && 'lg:grid-cols-[var(--blogs-rail-width)_minmax(0,1fr)]',
                )}
            >
                {showRail ? (
                    <aside className="blogs-sidebar scrollbar-controller scrollbar-vertical sticky top-(--blogs-header-height) hidden h-[calc(100svh-var(--blogs-header-height))] bg-sidebar px-3.5 py-6 lg:block">
                        {renderRail()}
                    </aside>
                ) : null}
                <div className="blogs-main flex min-w-0 flex-col gap-5 px-12 pt-10 pb-20 max-lg:px-5 max-lg:pt-0">
                    {showRail ? renderMobileNav() : null}
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Blogs;
