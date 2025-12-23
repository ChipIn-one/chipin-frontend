import { Box } from '@radix-ui/themes';

import { useJoinInviteLink } from 'hooks/useJoinInviteLink';

import PageLoader from 'basics/PageLoader';

const GroupJoinPage = () => {
    useJoinInviteLink();

    return (
        <Box py="6">
            <PageLoader />
        </Box>
    );
};

export default GroupJoinPage;
