export const GROUP_DESCRIPTION_MAX_LENGTH = 160;
export const GROUP_NAME_MAX_LENGTH = 50;

export type GroupIconCategoryKey = 'travel' | 'food' | 'home' | 'fun' | 'work';

export const GROUP_ICON_CATEGORIES: ReadonlyArray<{
    key: GroupIconCategoryKey;
    labelKey: string;
    icons: readonly string[];
}> = [
    {
        key: 'travel',
        labelKey: 'modal.categories.travel',
        icons: ['✈️', '🧳', '🏖️', '⛰️', '🗺️', '🌍', '🏕️', '🛳️', '🚂', '🏨', '🚢', '🚁'],
    },
    {
        key: 'food',
        labelKey: 'modal.categories.food',
        icons: ['🍽️', '🍕', '🍺', '☕', '🥂', '🛒', '🍣', '🍜', '🎂', '🥗', '🍷', '🍔'],
    },
    {
        key: 'home',
        labelKey: 'modal.categories.home',
        icons: ['🏠', '🏡', '⚡', '🌿', '📦', '💡', '🔧', '🛏️', '📱', '🖥️', '🐶', '🌱'],
    },
    {
        key: 'fun',
        labelKey: 'modal.categories.fun',
        icons: ['🎮', '🎬', '🎵', '⚽', '🎯', '🎪', '🎭', '🎡', '🏋️', '🎨', '🎤', '🎉'],
    },
    {
        key: 'work',
        labelKey: 'modal.categories.work',
        icons: ['💼', '📊', '💰', '⚖️', '🏦', '🔗', '🧩', '🚀', '🪙', '📋', '💸', '🎓'],
    },
];

export const DEFAULT_CATEGORY_KEY: GroupIconCategoryKey = 'travel';
export const ALL_GROUP_ICONS = GROUP_ICON_CATEGORIES.flatMap(category => category.icons);
export const DEFAULT_ICON = '✈️';
