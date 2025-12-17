import { Box, Button, Container } from '@radix-ui/themes';

import { useAuthStore } from 'store/authStore';

const ActivityPage = () => {
    const { signOut } = useAuthStore();

    return (
        <Box py="6">
            <Container size="4">
                <Button onClick={signOut}>Sign Out</Button>
            </Container>
        </Box>
    );
};

export default ActivityPage;
