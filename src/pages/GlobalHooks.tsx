import { useCheckPwaAndSignIn } from 'hooks/useCheckPwaAndSignIn';
import { useRoutesMeta } from 'hooks/useRoutesMeta';

const GlobalHooks = () => {
    useRoutesMeta();
    useCheckPwaAndSignIn();

    return null;
};

export default GlobalHooks;
