import { Button } from '@radix-ui/themes';

import { useAuthStore } from 'store/authStore';

import BottomNavMobile from 'components/BottomNavMobile';
import Header from 'components/Header';

const BalancesPage = () => {
    const { isLoggedIn, signOut } = useAuthStore();

    return (
        <>
            <Header />
            {isLoggedIn ? 'balances page' : 'Please log in to view your balances.'}
            <Button onClick={signOut}>Sign Out</Button>
            <BottomNavMobile />
        </>
    );
};

export default BalancesPage;
