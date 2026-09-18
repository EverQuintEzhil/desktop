/** KaTeX renders an unknown command as its raw source in `errorColor`, which defaults to a red that reads as a failure of the whole answer. */
export const KATEX_OPTIONS = { errorColor: 'currentColor' } as const;

/** Pulls the default prose scale down to a sidebar card's 14px/24px rhythm. */
export const CARD_PROSE_CLASS_NAME = [
    '[&_.prose]:text-sm [&_.prose]:text-text-secondary',
    '[&_.prose_:is(h1,h2,h3,h4,h5,h6)]:text-sm! [&_.prose_:is(h1,h2,h3,h4,h5,h6)]:font-semibold!',
    '[&_.prose_:is(h1,h2,h3,h4,h5,h6)]:mt-3! [&_.prose_:is(h1,h2,h3,h4,h5,h6)]:mb-1!',
    '[&_.prose_:is(h1,h2,h3,h4,h5,h6)]:text-foreground!',
    '[&_.prose_:is(h1,h2,h3,h4,h5,h6):first-child]:mt-0!',
    '[&_.prose_:is(a,span,p,li)]:text-sm! [&_.prose_:is(a,span,p,li)]:leading-6! [&_.prose_:is(p,ul,ol)]:mb-1.5!',
    '[&_.prose>:last-child]:mb-0!',
].join(' ');
