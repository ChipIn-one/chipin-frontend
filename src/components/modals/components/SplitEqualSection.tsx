import { Amount, UserAvatar } from 'basics';
import Big from 'bignumber.js';
import { LucideUsers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Flex, Text } from '@radix-ui/themes';

import { User } from 'api/chipin.types';
import { tryToBig } from 'helpers/numbers';

interface Props {
    members: User[];
    totalAmount: string;
    currency: string;
}

const SplitEqualSection = ({ members, totalAmount, currency }: Props) => {
    const { t } = useTranslation('group');

    const totalBig = tryToBig(totalAmount) ?? Big(0);
    const count = members.length;
    const perPerson =
        count > 0 ? totalBig.dividedBy(count).decimalPlaces(2, Big.ROUND_HALF_UP) : Big(0);

    return (
        <Flex direction="column" gap="3">
            <Flex align="center" gap="2" justify="center">
                <LucideUsers size={18} />
                <Text size="2" color="gray">
                    {t('expenses.modal.split.splitEquallyBetween', { count })}
                </Text>
            </Flex>

            {members.map(member => (
                <Flex key={member.id} justify="between" align="center">
                    <Flex align="center" gap="2">
                        <UserAvatar user={member} size="2" />
                        <Text size="2">{member.displayName}</Text>
                    </Flex>
                    <Text size="2" weight="medium">
                        <Amount value={perPerson} tokenCode={currency} />
                    </Text>
                </Flex>
            ))}

            <Flex justify="between" align="center">
                <Text size="2" color="gray">
                    {t('expenses.modal.split.eachPays')}
                </Text>
                <Text size="2" weight="bold" color="jade">
                    <Amount value={perPerson} tokenCode={currency} />
                </Text>
            </Flex>
        </Flex>
    );
};

export default SplitEqualSection;
