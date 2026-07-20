import { Flex, Separator } from '@radix-ui/themes';

import type { DebtOption } from '../internal';

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
}: Props) => (
    <Flex direction="column" gap="4">
        <DebtSection
            debts={youOwe}
            isExpanded={isYouOweExpanded}
            isUserOwing
            onToggle={onToggleYouOwe}
            onSelect={onSelect}
        />

        {youOwe.length > 0 && owedToYou.length > 0 && <Separator size="4" />}

        <DebtSection
            debts={owedToYou}
            isExpanded={isOwedToYouExpanded}
            isUserOwing={false}
            onToggle={onToggleOwedToYou}
            onSelect={onSelect}
        />
    </Flex>
);

export default DebtSelectionStep;
