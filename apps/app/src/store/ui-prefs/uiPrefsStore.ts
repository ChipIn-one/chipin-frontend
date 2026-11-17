// UI preferences (spec 03 §6): client state, not server data. The app mode moved here from the
// dashboard store (03-8), the last opened group from the groups store (03-10b).
import { create } from 'zustand';

import { getLocalUser } from 'helpers/localStorage';

export const APP_MODES = {
    GROUP: 'group',
    SOLO: 'solo',
} as const;

export type AppMode = (typeof APP_MODES)[keyof typeof APP_MODES];

export interface UiPrefsStore {
    appMode: AppMode;
    setAppMode: (appMode: AppMode) => void;
    /** The signed-in user's default (`settings.soloModeByDefault`), applied after a sign-in. */
    setDefaultAppMode: (isSoloModeByDefault: boolean) => void;
    /** The group opened last in this tab: the expense editor's default group. */
    lastGroupId: string | null;
    setLastGroupId: (groupId: string | null) => void;
    /** Back to the cached user's default (`LocalUser.settings`), as at startup; no last group. */
    resetUiPrefs: () => void;
}

const getDefaultAppMode = (isSoloModeByDefault: boolean): AppMode =>
    isSoloModeByDefault ? APP_MODES.SOLO : APP_MODES.GROUP;

const initialAppMode = (): AppMode =>
    getDefaultAppMode(getLocalUser()?.settings?.soloModeByDefault ?? false);

export const useUiPrefsStore = create<UiPrefsStore>(set => ({
    appMode: initialAppMode(),
    setAppMode: appMode => {
        set({ appMode });
    },
    setDefaultAppMode: isSoloModeByDefault => {
        set({ appMode: getDefaultAppMode(isSoloModeByDefault) });
    },
    lastGroupId: null,
    setLastGroupId: lastGroupId => {
        set({ lastGroupId });
    },
    resetUiPrefs: () => {
        set({ appMode: initialAppMode(), lastGroupId: null });
    },
}));

export const selectIsSoloMode = (state: UiPrefsStore) => state.appMode === APP_MODES.SOLO;

export const selectLastGroupId = (state: UiPrefsStore) => state.lastGroupId;
