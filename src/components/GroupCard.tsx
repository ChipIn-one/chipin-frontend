import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Card, Flex, Text } from '@radix-ui/themes';

import { ApiGroup } from 'api/chipin.types';
import { ROUTES } from 'constants/routes';
import { useGroupsStore } from 'store/groupsStore';

import { Amount } from 'basics/numbers';
import GroupAvatar from 'components/GroupAvatar';

interface Props {
    group: ApiGroup;
}

const GroupCard: React.FC<Props> = ({ group }) => {
    const { setSelectedGroup } = useGroupsStore();
    const { t } = useTranslation('dashboard');

    return (
        <Card asChild size="1">
            <Link to={`${ROUTES.GROUP}/${group.id}`} onClick={() => setSelectedGroup(group)}>
                <Flex gap="3" align="center">
                    <GroupAvatar group={group} size="5" />

                    <Flex direction="column">
                        <Text size="4" weight="bold" as="p">
                            {group.name}
                        </Text>

                        <Text size="2" color="grass" weight="medium" as="p">
                            {t('groupsCard.statusOwed')} <Amount value={15} customPrefix="$" />
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
    );
};

export default GroupCard;
