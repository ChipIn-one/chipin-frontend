import { useAuthToasts } from 'hooks/useAuthToasts';
import { useCheckOnlineStatus } from 'hooks/useCheckOnlineStatus';
import { useCheckPwa } from 'hooks/useCheckPwa';
import { useCheckSignIn } from 'hooks/useCheckSignIn';
import { useRoutesMeta } from 'hooks/useRoutesMeta';

const GlobalHooks = () => {
    // Permanent hooks
    useRoutesMeta();
    useCheckOnlineStatus();
    useCheckPwa();

    // Only mount hooks
    useCheckSignIn();
    useAuthToasts();

    return null;
};

export default GlobalHooks;
