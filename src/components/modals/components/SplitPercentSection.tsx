import { Amount, UserAvatar } from 'basics';
import Big from 'bignumber.js';
import { LucideMinus, LucidePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Flex, IconButton, Text } from '@radix-ui/themes';

import { User } from 'api/chipin.types';
import { themeColor } from 'helpers/colors';
import { tryToBig } from 'helpers/numbers';

const ProgressBar = styled.div`
    height: 4px;
    width: 100%;
    background-color: ${themeColor('gray4')};
    border-radius: var(--radius-full);
    overflow: hidden;
`;

const ProgressFill = styled.div<{ $percent: number; $isValid: boolean }>`
    height: 100%;
    width: ${({ $percent }) => Math.min($percent, 100)}%;
    background-color: ${({ $isValid }) => ($isValid ? themeColor('jade9') : themeColor('red9'))};
    transition:
        width 150ms ease,
        background-color 150ms ease;
`;

interface Props {
    members: User[];
    percentShares: Record<string, string>;
    onChangePercent: (userId: string, delta: number) => void;
    totalAmount: string;
    currency: string;
    currentUserId?: string;
}

const SplitPercentSection = ({
    members,
    percentShares,
    onChangePercent,
    totalAmount,
    currency,
    currentUserId,
}: Props) => {
    const { t } = useTranslation('group');

    const totalPercent = members.reduce((acc, member) => {
        return acc + (Number(percentShares[member.id]) || 0);
    }, 0);

    const isValidTotal = totalPercent === 100;

    const totalBig = tryToBig(totalAmount) ?? Big(0);
    const currentUserPercent = currentUserId ? Number(percentShares[currentUserId]) || 0 : 0;
    const yourShareBig = totalBig
        .multipliedBy(currentUserPercent)
        .dividedBy(100)
        .decimalPlaces(2, Big.ROUND_HALF_UP);

    const totalColor = isValidTotal ? 'jade' : 'red';

    return (
        <Flex direction="column" gap="3">
            <Flex direction="column" gap="1">
                <Flex justify="between" align="center">
                    <Flex align="center" gap="1">
                        <Text size="2" color="gray">
                            {t('expenses.modal.split.total')}
                        </Text>
                        <Text size="2" weight="bold" color={totalColor}>
                            {totalPercent}%
                        </Text>
                    </Flex>
                    <Text size="2" weight="bold" color={totalColor}>
                        {totalPercent}%
                    </Text>
                </Flex>
                <ProgressBar>
                    <ProgressFill $percent={totalPercent} $isValid={isValidTotal} />
                </ProgressBar>
            </Flex>

            {members.map(member => {
                const pct = Number(percentShares[member.id]) || 0;
                const isDecrementDisabled = pct <= 0;
                const isIncrementDisabled = totalPercent >= 100;

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
                                onClick={() => onChangePercent(member.id, -1)}
                                aria-label="-1%"
                            >
                                <LucideMinus size={12} />
                            </IconButton>
                            <Flex justify="center" minWidth="28px">
                                <Text size="2" weight="medium">
                                    {pct}
                                </Text>
                            </Flex>
                            <Text size="2" color="gray">
                                %
                            </Text>
                            <IconButton
                                size="1"
                                variant="soft"
                                color="gray"
                                disabled={isIncrementDisabled}
                                onClick={() => onChangePercent(member.id, 1)}
                                aria-label="+1%"
                            >
                                <LucidePlus size={12} />
                            </IconButton>
                        </Flex>
                    </Flex>
                );
            })}

            {currentUserId && (
                <Flex justify="between" align="center">
                    <Text size="2" color="gray">
                        {t('expenses.modal.split.yourShare')}
                    </Text>
                    <Text size="2" weight="bold" color="jade">
                        <Amount value={yourShareBig} tokenCode={currency} />
                    </Text>
                </Flex>
            )}
        </Flex>
    );
};

export default SplitPercentSection;
