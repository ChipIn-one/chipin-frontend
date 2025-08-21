import { useAuthStore } from 'store/authStore';

import BottomNavMobile from 'components/BottomNavMobile';
import Header from 'components/Header';

const ActivityPage = () => {
    const { isLoggedIn } = useAuthStore();

    return (
        <>
            <Header />
            {isLoggedIn ? 'activity page' : 'Please log in to view your activity.'}

            <BottomNavMobile />
        </>
    );
};

export default ActivityPage;
