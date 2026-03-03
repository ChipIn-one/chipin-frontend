import { useJoinInviteLink } from 'hooks/useJoinInviteLink';

import PageLoader from 'basics/PageLoader';

const GroupJoinPage = () => {
    useJoinInviteLink();

    return <PageLoader />;
};

export default GroupJoinPage;
