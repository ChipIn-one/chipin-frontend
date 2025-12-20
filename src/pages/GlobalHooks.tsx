import { useCheckOnlineStatus } from 'hooks/useCheckOnlineStatus';
import { useCheckPwaAndSignIn } from 'hooks/useCheckPwaAndSignIn';
import { useRoutesMeta } from 'hooks/useRoutesMeta';

const GlobalHooks = () => {
    useRoutesMeta();
    useCheckPwaAndSignIn();
    useCheckOnlineStatus();

    return null;
};

export default GlobalHooks;
