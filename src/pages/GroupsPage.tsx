import { useAuthStore } from 'store/authStore';

import BottomNavMobile from 'components/BottomNavMobile';
import Header from 'components/Header';

const GroupsPage = () => {
    const { isLoggedIn } = useAuthStore();

    return (
        <>
            <Header />
            {isLoggedIn ? 'groups page' : 'Please log in to view your groups.'}

            <BottomNavMobile />
        </>
    );
};

export default GroupsPage;
