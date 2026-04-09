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
