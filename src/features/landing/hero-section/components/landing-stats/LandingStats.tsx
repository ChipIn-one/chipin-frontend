import { useTranslation } from 'react-i18next';

import { Flex, Skeleton, Text } from '@radix-ui/themes';

import { selectLandingStats, useLandingStatsStore } from 'store/landing-stats-store';
import { selectLandingStatsLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { Amount } from 'basics/numbers';

import { LANDING_STATISTICS } from '../../internal';

const LandingStats = () => {
    const stats = useLandingStatsStore(selectLandingStats);
    const isStatsLoading = useLoadingStore(selectLandingStatsLoading);
    const { t } = useTranslation('landing');
    const isLoading = stats === null && isStatsLoading;

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
                                            <Amount type="summary" value={stats[field]} />
                                        ) : (
                                            '—'
                                        )}
                                    </Flex>
                                </Text>
                                <Text size="2" color="gray">
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
