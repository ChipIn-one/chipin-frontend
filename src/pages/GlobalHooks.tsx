import { useCheckOnlineStatus, useCheckPwa } from 'hooks/pwaHooks';
import { useAuthToasts } from 'hooks/useAuthToasts';
import { useCheckSignIn } from 'hooks/useCheckSignIn';
import { useRoutesMeta } from 'hooks/useRoutesMeta';
import { useSyncUserSettings } from 'hooks/useSyncUserSettings';

const GlobalHooks = () => {
    // Permanent hooks
    useRoutesMeta();
    useCheckOnlineStatus();
    useCheckPwa();
    useSyncUserSettings();

    // TODO: Use hooks
    // console.log(useCopyToClipboard('ttt'));
    // console.log(useDocumentTitle('ttt'));
    // console.log(useGeolocation());
    // console.log(usePreferredLanguage());
    // console.log(useQueue(1)); // FOR OFFLINE
    // console.log(useRenderInfo(1));
    // TODO: MAYBE USESPEECH FOR INPUTS WITH DEBTS?

    // Only mount hooks
    useCheckSignIn();
    useAuthToasts();

    return null;
};

export default GlobalHooks;
