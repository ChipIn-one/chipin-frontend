import { Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { formatRelativeTime } from 'helpers/time';

interface Props {
    createdAt: number;
    /** The user's time format: the caller reads it (`useUserSetting(isUserTime24H)`), reactively. */
    isTime24H: boolean;
}

const RelativeTime = ({ createdAt, isTime24H }: Props) => {
    const { i18n } = useTranslation();
    const locale = i18n.resolvedLanguage ?? i18n.language;

    return (
        <Text size="2" color="gray" as="span" align="right" wrap="nowrap">
            {formatRelativeTime(createdAt, locale, isTime24H)}
        </Text>
    );
};

export default RelativeTime;
