import { Box, Container, Heading } from '@radix-ui/themes';

import { useJoinInviteLink } from 'hooks/useJoinInviteLink';

import MobileNavigationBar from 'components/MobileNavigationBar';

const GroupJoinPage = () => {
    useJoinInviteLink();

    return (
        <Box py="6">
            <Container size="4">
                <Heading>Hey, we noticed you was invited to join group</Heading>

                <MobileNavigationBar />
            </Container>
        </Box>
    );
};

export default GroupJoinPage;
