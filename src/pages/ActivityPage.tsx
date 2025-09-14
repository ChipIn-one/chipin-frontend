import { Box, Button, Container } from '@radix-ui/themes';

import { useAuthStore } from 'store/authStore';

import BottomNavMobile from 'components/BottomNavMobile';
import Breadcrumbs from 'components/Breadcrumbs';

const ActivityPage = () => {
    const { signOut } = useAuthStore();

    return (
        <Box p="4">
            <Container size="4">
                <Breadcrumbs />
                <Button onClick={signOut}>Sign Out</Button>
                <BottomNavMobile />
            </Container>
        </Box>
    );
};

export default ActivityPage;
