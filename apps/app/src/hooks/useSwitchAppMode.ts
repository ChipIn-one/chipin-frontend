import { useNavigate } from 'react-router-dom';

import { getPreferredModeRoute } from 'helpers/routes';
import { APP_MODES, type AppMode, useUiPrefsStore } from 'store/ui-prefs';

// Switches the app between Group and Solo mode and opens that mode's home page (Dashboard or
// Solo): the mode switch and the Solo placeholders' `Go to dashboard` (DSH-016).
const useSwitchAppMode = () => {
    const navigate = useNavigate();
    const setAppMode = useUiPrefsStore(state => state.setAppMode);

    return (nextAppMode: AppMode) => {
        setAppMode(nextAppMode);
        void navigate(getPreferredModeRoute(nextAppMode === APP_MODES.SOLO));
    };
};

export { useSwitchAppMode };
