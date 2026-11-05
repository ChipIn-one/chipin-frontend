import { Flex, Skeleton, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { useStatsQuery } from 'entities/stats';

import { Amount } from 'basics/numbers';

import { LANDING_STATISTICS } from '../../internal';

const LandingStats = () => {
    const { data: stats, error } = useStatsQuery();
    const { t } = useTranslation('landing');
    // Data wins; without data, a final error shows the safe value, otherwise the skeleton.
    const isLoading = stats === undefined && error === null;

    return (
        <Flex
            role="region"
            aria-label={t('stats.regionLabel')}
            aria-busy={isLoading}
            wrap="wrap"
            gap="6"
            justify="center"
            pt="4"
            width="100%"
        >
            {LANDING_STATISTICS.map(({ field, labelKey, Icon }) => {
                const label = t(`stats.${labelKey}`);

                return (
                    <Flex
                        key={field}
                        role="group"
                        aria-label={label}
                        direction="column"
                        align="center"
                        gap="1"
                        minWidth="120px"
                        flexGrow="1"
                        flexShrink="1"
                        flexBasis="0"
                    >
                        {isLoading ? (
                            <>
                                <Flex align="center" gap="1">
                                    <Skeleton width="20px" height="20px" />
                                    <Skeleton width="72px" height="24px" />
                                </Flex>
                                <Skeleton width="96px" height="16px" />
                            </>
                        ) : (
                            <>
                                <Text size="5" weight="bold" color="green">
                                    <Flex align="center" gap="1">
                                        <Icon aria-hidden="true" />
                                        {stats ? (
                                            <Amount
                                                type="summary"
                                                value={stats[field]}
                                                isAbsolute={false}
                                            />
                                        ) : (
                                            '—'
                                        )}
                                    </Flex>
                                </Text>
                                <Text size="3" color="gray" align="center">
                                    {label}
                                </Text>
                            </>
                        )}
                    </Flex>
                );
            })}
        </Flex>
    );
};

export default LandingStats;
