import { PROP_COLOR } from '@chipin/tokens/theme';
import { Badge, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import styles from './LedgerScopeBadge.module.css';

interface Props {
    groupId: string | null;
    groupName: string | null;
    /** The group whose page shows the badge (route `groupId`); the badge hides for that group. */
    currentGroupId?: string;
}

const LedgerScopeBadge = ({ groupId, groupName, currentGroupId }: Props) => {
    const { t } = useTranslation('activity');

    if (currentGroupId === groupId) {
        return null;
    }

    const isGroupEvent = groupId !== null && Boolean(groupName);

    return (
        <Badge className={styles.root} size="1" variant="soft" color={PROP_COLOR.neutral}>
            {isGroupEvent ? (
                <Text as="span" truncate>
                    {groupName}
                </Text>
            ) : (
                t('event.betweenFriends')
            )}
        </Badge>
    );
};

export { LedgerScopeBadge };
