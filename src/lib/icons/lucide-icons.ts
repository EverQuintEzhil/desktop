import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const iconAliases: Record<string, string> = {
    attachment: 'paperclip',
    card: 'idcard',
    cog: 'settings',
    coin: 'coins',
    gear: 'settings',
    news: 'newspaper',
    photo: 'image',
    picture: 'image',
    sliders: 'slidersvertical',
    tag: 'tags',
    tool: 'wrench',
    upload: 'cloudupload',
    temp: 'thermometer',
    temperature: 'thermometer',
    topk: 'layers',
    topp: 'percent',
    maxtokens: 'hash',
    maxoutput: 'ruler',
    tokens: 'hash',
    seed: 'binary',
    random: 'dices',
    json: 'braces',
    jsonmode: 'braces',
    struct: 'braces',
    stream: 'radio',
    streaming: 'waves',
    model: 'cpu',
    reasoning: 'brain',
    creativity: 'sparkles',
    creative: 'sparkles',
    vision: 'scaneye',
    multimodal: 'scaneye',
    imageinput: 'image',
    penalty: 'ban',
    frequency: 'repeat',
    presence: 'messagecircle',
    tools: 'wrench',
    functions: 'squarefunction',
    stop: 'circlestop',
    safety: 'shieldalert',
    latency: 'timer',
    language: 'languages',
    voice: 'audiowaveform',
    circleinfo: 'info',
    magnifyingglass: 'search',
    xmark: 'x',
};

const normalizeIconName = (iconName: string) =>
    iconName
        .trim()
        .toLowerCase()
        .replace(/^fa[srlbdk]?\s*/, '')
        .replace(/^fa-/, '')
        .replace(/icon$/, '')
        .replace(/[^a-z0-9]+/g, '');

const isLucideIcon = (value: unknown): value is LucideIcon =>
    typeof value === 'object' && value !== null && '$$typeof' in value && 'render' in value;

const lucideIconsByName = Object.entries(LucideIcons).reduce<Record<string, LucideIcon>>((acc, [exportName, value]) => {
    if (isLucideIcon(value)) {
        acc[normalizeIconName(exportName)] = value;
    }

    return acc;
}, {});

export const getLucideIcon = (iconName?: string | null): LucideIcon | undefined => {
    if (!iconName) {
        return undefined;
    }

    const normalizedIconName = normalizeIconName(iconName);
    const resolvedIconName = iconAliases[normalizedIconName] ?? normalizedIconName;

    return lucideIconsByName[resolvedIconName];
};
