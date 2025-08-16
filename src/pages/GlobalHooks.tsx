import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { useAuthStore } from 'store/authStore';
import { checkAndRemoveExpiredToken } from 'store/IDB/auth';

const GlobalHooks = () => {
    const navigate = useNavigate();
    const { setIsLoggedIn } = useAuthStore();

    useEffect(() => {
        checkAndRemoveExpiredToken()
            .then(isValid => {
                if (!isValid) {
                    navigate(ROUTES.HOME);
                    setIsLoggedIn(false);
                } else {
                    setIsLoggedIn(true);
                }
            })
            .catch(() => {
                navigate(ROUTES.HOME);
                setIsLoggedIn(false);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
};

export default GlobalHooks;
