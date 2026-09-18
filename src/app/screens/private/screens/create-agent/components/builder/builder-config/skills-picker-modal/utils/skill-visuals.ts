const SKILL_COLOR_PALETTE = ['#4285F4', '#0F9D58', '#EA4335', '#4A154B', '#24292e', '#6264A7', '#0078D4', '#7048ff'];

export const getSkillAbbr = (name: string): string => {
    const words = name.split(/\s+/).filter(Boolean);

    if (words.length >= 2) {
        const initials = words[0][0] + words[1][0];

        return initials
            .replace(/[^a-zA-Z0-9]/g, '')
            .toUpperCase()
            .slice(0, 2);
    }

    const alphanum = name.replace(/[^a-zA-Z0-9]/g, '');

    return alphanum.toUpperCase().slice(0, 2) || '??';
};

export const getSkillColor = (id: string): string => {
    let hash = 0;

    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }

    return SKILL_COLOR_PALETTE[hash % SKILL_COLOR_PALETTE.length];
};
