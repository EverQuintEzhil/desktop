/**
 * Shared colours for the two blog rails, which sit on the `sidebar` surface both in the desktop
 * aside and the mobile sheet. It is the `sidebar` family, not `primary`: `--sidebar` is the brand
 * colour in light but re-pointed to a dark surface in `.dark`, where `--primary` flips to
 * near-white. The active row pairs `sidebar-foreground` with `sidebar` so it contrasts in both
 * themes — the stock `sidebar-primary-foreground` is `--primary`, near-white on the white pill in dark.
 */
export const BLOG_NAV_PALETTE = {
    heading: 'text-sidebar-foreground/70',
    muted: 'text-sidebar-foreground/70',
    row: 'text-sidebar-foreground! hover:bg-sidebar-foreground/10',
    rowActive: 'bg-sidebar-foreground text-sidebar!',
    toggle: 'text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground',
    rule: 'border-sidebar-foreground/20',
    article: 'border-transparent text-sidebar-foreground/70! hover:text-sidebar-foreground!',
    articleActive: 'border-sidebar-foreground text-sidebar-foreground!',
    skeleton: 'bg-sidebar-foreground/15',
};
