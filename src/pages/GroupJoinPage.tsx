import { Box, Container, Heading } from '@radix-ui/themes';

import { useJoinInviteLink } from 'hooks/useJoinInviteLink';

import MobileNavBar from 'components/Navs/MobileNavBar';

const GroupJoinPage = () => {
    useJoinInviteLink();

    return (
        <Box py="6">
            <Container size="4">
                <Heading>Hey, we noticed you was invited to join group</Heading>

                <MobileNavBar />
            </Container>
        </Box>
    );
};

export default GroupJoinPage;
