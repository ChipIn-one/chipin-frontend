import { useAuthStore } from 'store/authStore';

import BottomNavMobile from 'components/BottomNavMobile';
import Header from 'components/Header';

const SettingsPage = () => {
    const { isLoggedIn } = useAuthStore();

    return (
        <>
            <Header />
            {isLoggedIn ? 'settings page' : 'Please log in to view your settings.'}

            <BottomNavMobile />
        </>
    );
};

export default SettingsPage;
