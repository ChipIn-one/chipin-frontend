import { useTranslation } from 'react-i18next';

import { Text } from '@radix-ui/themes';

import { formatRelativeTime } from 'helpers/time';

interface Props {
    createdAt: number;
}

const RelativeTime = ({ createdAt }: Props) => {
    const { i18n } = useTranslation();
    const locale = i18n.resolvedLanguage ?? i18n.language;

    return (
        <Text size="2" color="gray" as="span" align="right" wrap="nowrap">
            {formatRelativeTime(createdAt, locale)}
        </Text>
    );
};

export default RelativeTime;
