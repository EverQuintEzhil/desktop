import { HELP_CENTER_PATH } from '../../blogs/constants';

/** The agent has the article corpus as its data store, so the URL and title are the reference it needs. */
export const buildArticlePrompt = (title: string, slug: string): string => {
    const url = `${window.location.origin}${HELP_CENTER_PATH}/${slug}`;

    return `I'm reading the help article "${title}" (${url}).\n\nHelp me understand it — start with a short summary, then answer my follow-up questions.`;
};
