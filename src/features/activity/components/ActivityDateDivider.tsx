import { useTranslation } from 'react-i18next';

import { Box, Flex, Separator, Text } from '@radix-ui/themes';

import { formatActivityDateDivider } from 'helpers/time';

interface Props {
    createdAt: number;
}

const ActivityDateDivider = ({ createdAt }: Props) => {
    const { t, i18n } = useTranslation('activity');
    const locale = i18n.resolvedLanguage ?? i18n.language;
    const label = formatActivityDateDivider(createdAt, locale, {
        today: t('dateDivider.today'),
        yesterday: t('dateDivider.yesterday'),
    });

    return (
        <Flex align="center" gap="3" py="2">
            <Box flexGrow="1">
                <Separator size="4" />
            </Box>
            <Text size="1" color="gray" weight="medium" wrap="nowrap">
                {label}
            </Text>
            <Box flexGrow="1">
                <Separator size="4" />
            </Box>
        </Flex>
    );
};

export default ActivityDateDivider;
