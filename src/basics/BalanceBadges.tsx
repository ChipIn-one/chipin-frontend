import { ComponentProps, useState } from 'react';
import Big from 'bignumber.js';
import { useTranslation } from 'react-i18next';

import { Badge, Button, Flex } from '@radix-ui/themes';

import { BalanceBadgesSkeleton } from 'components/skeletons';

import { Amount } from './numbers';

export interface BadgeItem {
    tokenCode: string;
    value: Big | null;
    color: ComponentProps<typeof Badge>['color'];
}

const DEFAULT_MAX_VISIBLE = 3;

interface Props {
    items: BadgeItem[];
    isLoading?: boolean;
    maxVisible?: number;
    overflowColor?: ComponentProps<typeof Badge>['color'];
}

const BalanceBadges: React.FC<Props> = ({
    items,
    isLoading = false,
    maxVisible = DEFAULT_MAX_VISIBLE,
    overflowColor = 'gray',
}) => {
    const { t } = useTranslation('common');
    const [isExpanded, setIsExpanded] = useState(false);

    if (!isLoading && items.length <= 1) {
        return null;
    }

    if (isLoading) {
        return <BalanceBadgesSkeleton />;
    }

    const visibleItems = isExpanded ? items : items.slice(0, maxVisible);
    const hiddenCount = items.length - visibleItems.length;

    return (
        <Flex gap="2" wrap="wrap" align="center">
            {visibleItems.map(item => (
                <Badge key={item.tokenCode} color={item.color} variant="soft" size="3">
                    <Amount value={item.value} tokenCode={item.tokenCode} precision={0} />
                </Badge>
            ))}

            {!isExpanded && hiddenCount > 0 && (
                <Button
                    color={overflowColor}
                    variant="soft"
                    size="1"
                    onClick={() => setIsExpanded(true)}
                >
                    +{hiddenCount}
                </Button>
            )}

            {isExpanded && (
                <Button
                    color={overflowColor}
                    variant="soft"
                    size="1"
                    onClick={() => setIsExpanded(false)}
                >
                    {t('buttons.hide')}
                </Button>
            )}
        </Flex>
    );
};

export default BalanceBadges;
