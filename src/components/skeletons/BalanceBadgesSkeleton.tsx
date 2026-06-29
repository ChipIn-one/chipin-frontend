import { useTranslation } from 'react-i18next';

import { Badge, Flex, Skeleton } from '@radix-ui/themes';

const SKELETON_COUNT = 3;

export const BalanceBadgesSkeleton = () => {
    const { t } = useTranslation('skeletons');

    return (
        <Flex gap="2" wrap="wrap">
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <Skeleton key={index}>
                    <Badge variant="soft" size="3">
                        {t('balanceBadges.amount')}
                    </Badge>
                </Skeleton>
            ))}
        </Flex>
    );
};
