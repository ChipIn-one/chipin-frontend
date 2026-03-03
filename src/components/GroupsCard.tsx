import { Link } from 'react-router-dom';

import { Card, Flex, Text } from '@radix-ui/themes';

import { ApiGroup } from 'api/chipin.types';
import { useGroupsStore } from 'store/groupsStore';

import { Amount } from 'basics/numbers';

import { ROUTES } from '../constants/routes';

import GroupAvatar from './GroupAvatar';
import UsersRow from './UsersRow';

interface GroupCardProps {
    groups: ApiGroup[];
}

export const GroupsCard: React.FC<GroupCardProps> = ({ groups }) => {
    const { setSelectedGroup } = useGroupsStore();

    return (
        <>
            {groups.map(group => (
                <Card variant={'classic'} key={group.id} asChild>
                    <Link
                        to={`${ROUTES.GROUP}/${group.id}`}
                        onClick={() => setSelectedGroup(group)}
                    >
                        <Flex gap="4" align="center" mb="2">
                            <GroupAvatar group={group} />

                            <Flex direction="column" gap="1" width="100%">
                                <Text size="5" weight="bold" as="p">
                                    {group.name}
                                </Text>

                                <UsersRow members={group.members} />

                                <Text size="2" color="grass" as="p">
                                    You are owed <Amount value={15} customPrefix="$" /> in this
                                    group
                                </Text>
                            </Flex>
                        </Flex>
                    </Link>
                </Card>
            ))}
        </>
    );
};
