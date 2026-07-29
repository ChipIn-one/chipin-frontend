import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { Badge, Text } from '@radix-ui/themes';

interface Props {
    groupId: string | null;
    groupName: string | null;
    groupEmoji?: string | null;
}

const LedgerScopeBadge = ({ groupId, groupName, groupEmoji }: Props) => {
    const { t } = useTranslation('activity');
    const { groupId: routeGroupId } = useParams<{ groupId: string }>();

    if (routeGroupId === groupId) {
        return null;
    }

    const isGroupEvent = groupId !== null && Boolean(groupName);

    return (
        <Badge size="1" variant="soft" color="gray">
            {isGroupEvent ? (
                <>
                    {groupEmoji ? (
                        <Text as="span" mr="1">
                            {groupEmoji}
                        </Text>
                    ) : null}
                    <Text as="span">{groupName}</Text>
                </>
            ) : (
                t('event.betweenFriends')
            )}
        </Badge>
    );
};

export { LedgerScopeBadge };
