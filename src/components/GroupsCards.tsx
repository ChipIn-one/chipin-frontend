import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Card, Flex, Text } from '@radix-ui/themes';

import { ApiGroup } from 'api/chipin.types';
import { useGroupsStore } from 'store/groupsStore';

import { Amount } from 'basics/numbers';

import { ROUTES } from '../constants/routes';

import GroupAvatar from './GroupAvatar';

interface Props {
    groups: ApiGroup[];
}

const GroupsCards: React.FC<Props> = ({ groups }) => {
    const { setSelectedGroup } = useGroupsStore();
    const { t } = useTranslation();

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
                                    {t('dashboard.groupsCard.statusOwed')}{' '}
                                    <Amount value={15} customPrefix="$" />
                                </Text>

                                <Text size="1" color="gray" as="p">
                                    {t('dashboard.groupsCard.members', {
                                        count: group.members.length,
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
