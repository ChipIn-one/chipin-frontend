import { Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { getLocalUser } from 'helpers/localStorage';
import { formatRelativeTime } from 'helpers/time';

interface Props {
    createdAt: number;
}

const RelativeTime = ({ createdAt }: Props) => {
    const { i18n } = useTranslation();
    const locale = i18n.resolvedLanguage ?? i18n.language;
    // `basics` cannot read the self query: the cached user's settings follow every self load.
    const isUserTime24H = getLocalUser()?.settings.timeFormat === '24h';

    return (
        <Text size="2" color="gray" as="span" align="right" wrap="nowrap">
            {formatRelativeTime(createdAt, locale, isUserTime24H)}
        </Text>
    );
};

export default RelativeTime;
