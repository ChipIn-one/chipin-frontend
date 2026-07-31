import { ROUTES } from 'constants/routes';

const getPreferredModeRoute = (isSoloModeByDefault: boolean): string =>
    isSoloModeByDefault ? ROUTES.SOLO : ROUTES.DASHBOARD;

export { getPreferredModeRoute };
