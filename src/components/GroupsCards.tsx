import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Avatar, Card, Flex, Skeleton, Text } from '@radix-ui/themes';

import { ApiGroup } from 'api/chipin.types';
import { useGroupsStore } from 'store/groupsStore';
import { selectDashboardFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { Amount } from 'basics/numbers';

import { ROUTES } from '../constants/routes';

import GroupAvatar from './GroupAvatar';

interface Props {
    groups: ApiGroup[];
}

const SKELETON_COUNT = 5;

const GroupsCards: React.FC<Props> = ({ groups }) => {
    const isDashboardFetched = useLoadingStore(selectDashboardFetched);
    const { setSelectedGroup } = useGroupsStore();
    const { t } = useTranslation('dashboard');

    if (!isDashboardFetched) {
        return (
            <Flex direction="column" gap="4">
                {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                    <Card key={index} size="1">
                        <Flex gap="3" align="center">
                            <Skeleton>
                                <Avatar size="5" fallback="•" />
                            </Skeleton>

                            <Flex direction="column">
                                <Text size="4" weight="bold" as="p">
                                    <Skeleton>Group name</Skeleton>
                                </Text>

                                <Text size="2" color="grass" weight="medium" as="p">
                                    <Skeleton>You are owed $15.00</Skeleton>
                                </Text>

                                <Text size="1" color="gray" as="p">
                                    <Skeleton>3 members</Skeleton>
                                </Text>
                            </Flex>
                        </Flex>
                    </Card>
                ))}
            </Flex>
        );
    }

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
