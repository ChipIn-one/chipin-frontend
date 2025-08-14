import { useAuthStore } from 'store/authStore';

import Header from 'components/Header';

const BalancesPage = () => {
    const { isLoggedIn } = useAuthStore();
    return (
        <>
            <Header />
            {isLoggedIn ? 'balances page' : 'Please log in to view your balances.'}
        </>
    );
};

export default BalancesPage;
