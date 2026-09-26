import { useTranslation } from 'react-i18next';

import { Flex, Separator } from '@radix-ui/themes';

import type { DebtOption } from '../internal';
import { DebtSelectionScrollArea } from '../styled';

import DebtSection from './DebtSection';

interface Props {
    youOwe: DebtOption[];
    owedToYou: DebtOption[];
    isYouOweExpanded: boolean;
    isOwedToYouExpanded: boolean;
    onToggleYouOwe: () => void;
    onToggleOwedToYou: () => void;
    onSelect: (debt: DebtOption) => void;
}

const DebtSelectionStep = ({
    youOwe,
    owedToYou,
    isYouOweExpanded,
    isOwedToYouExpanded,
    onToggleYouOwe,
    onToggleOwedToYou,
    onSelect,
}: Props) => {
    const { t } = useTranslation('group');

    return (
        <DebtSelectionScrollArea
            role="region"
            aria-label={t('group:page.settleUp.chooseDebtTitle')}
            type="auto"
            scrollbars="vertical"
        >
            <Flex direction="column" gap="4" pr={{ initial: '0', sm: '4' }}>
                <DebtSection
                    debts={youOwe}
                    isExpanded={isYouOweExpanded}
                    isUserOwing
                    onToggle={onToggleYouOwe}
                    onSelect={onSelect}
                />

                {youOwe.length > 0 && owedToYou.length > 0 && (
                    <Separator size="4" />
                )}

                <DebtSection
                    debts={owedToYou}
                    isExpanded={isOwedToYouExpanded}
                    isUserOwing={false}
                    onToggle={onToggleOwedToYou}
                    onSelect={onSelect}
                />
            </Flex>
        </DebtSelectionScrollArea>
    );
};

export default DebtSelectionStep;
