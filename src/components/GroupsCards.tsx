import { Flex } from '@radix-ui/themes';

import { ApiGroup } from 'api/chipin.types';
import { selectDashboardFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { GroupsCardsSkeleton } from 'components/skeletons';

import GroupCard from './GroupCard';

interface Props {
    groups: ApiGroup[];
}

const GroupsCards: React.FC<Props> = ({ groups }) => {
    const isDashboardFetched = useLoadingStore(selectDashboardFetched);

    if (!isDashboardFetched) {
        return <GroupsCardsSkeleton />;
    }

    return (
        <Flex direction="column" gap="4">
            {groups.map(group => (
                <GroupCard key={group.id} group={group} />
            ))}
        </Flex>
    );
};

export default GroupsCards;
