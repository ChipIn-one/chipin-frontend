import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Card, Flex, Text } from '@radix-ui/themes';

import { ApiGroup } from 'api/chipin.types';
import { useGroupsStore } from 'store/groupsStore';

import { Amount } from 'basics/numbers';

import { ROUTES } from '../constants/routes';

import GroupAvatar from './GroupAvatar';
// import { useLoadingStore } from 'store/loadingStore';

interface Props {
    groups: ApiGroup[];
}

// const GROUPS_SKELETON_ITEMS = Array.from({ length: 3 }, (_, index) => ({
//     id: `group-skeleton-${index}`,
//     picture: '',
//     name: 'Group name',
// }));

const GroupsCards: React.FC<Props> = ({ groups }) => {
    // const isLoadingDashboard = useLoadingStore(state => state.dashboard.data);

    const { setSelectedGroup } = useGroupsStore();
    const { t } = useTranslation('dashboard');

    // TODO: ADD IS LOADING GROUP ALSO

    // const isSkeletonShown = isLoadingDashboard && !groups.length;
    // const visibleGroups = isSkeletonShown ? GROUPS_SKELETON_ITEMS : groups;

    return (
        <Flex direction="column" gap="4">
            {groups.map(group => (
                <Card key={group.id} asChild size="1">
                    <Link
                        to={`${ROUTES.GROUP}/${group.id}`}
                        onClick={() => setSelectedGroup(group)}
                    >
                        <Flex gap="3" align="center">
                            <GroupAvatar group={group} size="5" />

                            <Flex direction="column">
                                <Text size="4" weight="bold" as="p">
                                    {group.name}
                                </Text>

                                <Text size="2" color="grass" weight="medium" as="p">
                                    {t('groupsCard.statusOwed')}{' '}
                                    <Amount value={15} customPrefix="$" />
                                </Text>

                                <Text size="1" color="gray" as="p">
                                    {t('groupsCard.members', {
                                        count: group?.members?.length,
                                    })}
                                </Text>
                            </Flex>
                        </Flex>
                    </Link>
                </Card>
            ))}
        </Flex>
    );
};

export default GroupsCards;
