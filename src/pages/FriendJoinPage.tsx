import { useFriendInviteLink } from 'hooks/useFriendInviteLink';

import PageLoader from 'basics/PageLoader';

const FriendJoinPage = () => {
    useFriendInviteLink();

    return <PageLoader />;
};

export default FriendJoinPage;
