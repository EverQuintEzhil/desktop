import type { ChatUiConfig, ApiUiConfig, AppUiConfig, GalleryUiConfig, ComponentType, UiConfig } from './types';

export const DEFAULT_CHAT_CONFIG: ChatUiConfig = {
    componentType: 'chat',
    type: 'chat',
    home: {
        title: '',
    },
};

export const DEFAULT_API_CONFIG: ApiUiConfig = {
    componentType: 'api',
    type: 'jsonviewer',
    formSpec: [],
};

export const DEFAULT_GALLERY_CONFIG: GalleryUiConfig = {
    componentType: 'gallery',
    type: 'image',
};

export const DEFAULT_APP_CONFIG: AppUiConfig = {
    componentType: 'app',
    type: 'app',
    home: {
        title: '',
    },
    app: {
        refName: '',
    },
};

export const DEFAULT_CONFIG_BY_COMPONENT: Record<ComponentType, UiConfig> = {
    chat: DEFAULT_CHAT_CONFIG,
    api: DEFAULT_API_CONFIG,
    gallery: DEFAULT_GALLERY_CONFIG,
    app: DEFAULT_APP_CONFIG,
};
