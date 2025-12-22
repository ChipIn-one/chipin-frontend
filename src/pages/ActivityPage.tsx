import { Button, Container } from '@radix-ui/themes';

import { useAuthStore } from 'store/authStore';

import MobileNavBar from 'components/Navs/MobileNavBar';

const ActivityPage = () => {
    const { signOut } = useAuthStore();

    return (
        <Container size="4">
            <Button onClick={signOut}>Sign Out</Button>
            <MobileNavBar />
        </Container>
    );
};

export default ActivityPage;
