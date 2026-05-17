import { LucideMinus, LucidePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Flex, IconButton, Text } from '@radix-ui/themes';

import { User } from 'api/chipin.types';
import { Amount, UserAvatar } from 'basics';

type AssignedState = 'exact' | 'under' | 'over';

interface Props {
    members: User[];
    amountShares: Record<string, string>;
    onChangeAmount: (userId: string, delta: number) => void;
    totalAmount: string;
    currency: string;
    step: number;
}

const SplitAmountsSection = ({
    members,
    amountShares,
    onChangeAmount,
    totalAmount,
    currency,
    step,
}: Props) => {
    const { t } = useTranslation('group');

    const total = Number(totalAmount) || 0;

    const assigned = members.reduce((acc, member) => {
        return acc + (Number(amountShares[member.id]) || 0);
    }, 0);

    const difference = Math.abs(total - assigned);

    const assignedState: AssignedState =
        assigned === total ? 'exact' : assigned < total ? 'under' : 'over';

    const assignedColor =
        assignedState === 'exact' ? 'jade' : assignedState === 'under' ? 'red' : 'amber';

    const summaryLabel = `${t('expenses.modal.split.totalAssigned')}`;

    return (
        <Flex direction="column" gap="3">
            <Flex justify="between" align="center">
                <Text size="2" color="gray">
                    {summaryLabel}
                </Text>
                <Flex align="center" gap="1">
                    <Text size="2" weight="bold" color={assignedColor}>
                        <Amount value={assigned} tokenCode={currency} />
                    </Text>
                    <Text size="2" color="gray">
                        /
                    </Text>
                    <Text size="2" weight="bold" color={assignedColor}>
                        <Amount value={total} tokenCode={currency} />
                    </Text>
                </Flex>
            </Flex>

            {members.map(member => {
                const share = Number(amountShares[member.id]) || 0;
                const isDecrementDisabled = share <= 0;

                return (
                    <Flex key={member.id} justify="between" align="center">
                        <Flex align="center" gap="2" flexGrow="1">
                            <UserAvatar user={member} size="2" />
                            <Text size="2">{member.displayName}</Text>
                        </Flex>
                        <Flex align="center" gap="1">
                            <IconButton
                                size="1"
                                variant="soft"
                                color="gray"
                                disabled={isDecrementDisabled}
                                onClick={() => onChangeAmount(member.id, -step)}
                                aria-label={`-${step}`}
                            >
                                <LucideMinus size={12} />
                            </IconButton>
                            <Text size="2" color="gray">
                                $
                            </Text>
                            <Flex justify="center" minWidth="48px">
                                {/* toFixed(2) is used here for interactive stepper display only — not for API submission */}
                                <Text size="2" weight="medium">
                                    {share.toFixed(2)}
                                </Text>
                            </Flex>
                            <IconButton
                                size="1"
                                variant="soft"
                                color="gray"
                                onClick={() => onChangeAmount(member.id, step)}
                                aria-label={`+${step}`}
                            >
                                <LucidePlus size={12} />
                            </IconButton>
                        </Flex>
                    </Flex>
                );
            })}

            <Flex justify="between" align="center">
                <Text size="2" color="gray">
                    {t('expenses.modal.split.difference')}
                </Text>
                <Text
                    size="2"
                    weight="bold"
                    color={assignedState === 'exact' ? 'jade' : assignedColor}
                >
                    <Amount value={difference} tokenCode={currency} />
                </Text>
            </Flex>
        </Flex>
    );
};

export default SplitAmountsSection;
