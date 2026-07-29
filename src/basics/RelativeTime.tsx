import { useTranslation } from 'react-i18next';

import { Text } from '@radix-ui/themes';

import { formatRelativeTime } from 'helpers/time';
import { selectIsUserTime24H } from 'store/usersSelectors';
import { useUsersStore } from 'store/usersStore';

interface Props {
    createdAt: number;
}

const RelativeTime = ({ createdAt }: Props) => {
    const { i18n } = useTranslation();
    const locale = i18n.resolvedLanguage ?? i18n.language;
    const isUserTime24H = useUsersStore(selectIsUserTime24H);

    return (
        <Text size="2" color="gray" as="span" align="right" wrap="nowrap">
            {formatRelativeTime(createdAt, locale, isUserTime24H)}
        </Text>
    );
};

export default RelativeTime;
