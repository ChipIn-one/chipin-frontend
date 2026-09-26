import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

import { Badge, Text } from '@radix-ui/themes';

const ScopeBadge = styled(Badge)`
    max-width: 100%;
`;

interface Props {
    groupId: string | null;
    groupName: string | null;
}

const LedgerScopeBadge = ({ groupId, groupName }: Props) => {
    const { t } = useTranslation('activity');
    const { groupId: routeGroupId } = useParams<{ groupId: string }>();

    if (routeGroupId === groupId) {
        return null;
    }

    const isGroupEvent = groupId !== null && Boolean(groupName);

    return (
        <ScopeBadge size="1" variant="soft" color="gray">
            {isGroupEvent ? (
                <Text as="span" truncate>
                    {groupName}
                </Text>
            ) : (
                t('event.betweenFriends')
            )}
        </ScopeBadge>
    );
};

export { LedgerScopeBadge };
