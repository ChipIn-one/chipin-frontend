import { BalanceSummaryText } from 'basics';
import { useTranslation } from 'react-i18next';

import { Box, Flex, Separator, Text } from '@radix-ui/themes';

import type { BalanceEntry } from 'api/chipin.raw.types';
import { formatActivityDateDivider } from 'helpers/time';

interface Props {
    createdAt: number;
    summary: BalanceEntry[];
}

const ActivityDateDivider = ({ createdAt, summary }: Props) => {
    const { t, i18n } = useTranslation('activity');
    const locale = i18n.resolvedLanguage ?? i18n.language;
    const label = formatActivityDateDivider(createdAt, locale, {
        today: t('dateDivider.today'),
        yesterday: t('dateDivider.yesterday'),
    });

    return (
        <Flex align="center" gap="3" py="2">
            <Text size="1" color="gray" weight="medium" wrap="nowrap">
                {label}
            </Text>

            <Box flexGrow="1">
                <Separator size="4" />
            </Box>

            {summary.length > 0 && <BalanceSummaryText entries={summary} size="1" align="right" />}
        </Flex>
    );
};

export default ActivityDateDivider;
