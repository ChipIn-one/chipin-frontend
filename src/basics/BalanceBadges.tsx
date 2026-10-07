import { ComponentProps, useState } from 'react';
import styled from 'styled-components';
import { LucideChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge, Button, Flex } from '@radix-ui/themes';

import { BalanceBadgesSkeleton } from 'components/skeletons';

import { Amount } from './numbers';

export interface BadgeItem {
    tokenCode: string;
    value: number;
    color: ComponentProps<typeof Badge>['color'];
}

const BalanceBadgesButton = styled(Button)`
    height: calc(var(--line-height-2) + var(--space-2));
    padding-inline: calc(var(--space-2) * 1.25);
`;

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

    if (!isLoading && items.length === 0) {
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
                    <Amount type='summary' value={item.value} tokenCode={item.tokenCode} precision={0} />
                </Badge>
            ))}

            {!isExpanded && hiddenCount > 0 && (
                <BalanceBadgesButton
                    color={overflowColor}
                    variant="soft"
                    size="2"
                    onClick={() => setIsExpanded(true)}
                >
                    +{hiddenCount}
                </BalanceBadgesButton>
            )}

            {isExpanded && (
                <BalanceBadgesButton
                    color={overflowColor}
                    variant="soft"
                    size="2"
                    onClick={() => setIsExpanded(false)}
                >
                    <LucideChevronLeft size={16} />
                    {t('buttons.hide')}
                </BalanceBadgesButton>
            )}
        </Flex>
    );
};

export default BalanceBadges;
