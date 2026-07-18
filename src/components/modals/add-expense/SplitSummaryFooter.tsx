import { Amount } from 'basics';

import { Flex, Separator, Text } from '@radix-ui/themes';

interface Props {
    label: string;
    amount: number;
    currency: string;
}

const SplitSummaryFooter = ({ label, amount, currency }: Props) => {
    return (
        <Flex direction="column" gap="3" pt="3">
            <Separator size="4" />
            <Flex justify="between" align="center" gap="3">
                <Text size="2" color="gray">
                    {label}
                </Text>
                <Text size="2" weight="bold">
                    <Amount value={amount} tokenCode={currency} />
                </Text>
            </Flex>
        </Flex>
    );
};

export default SplitSummaryFooter;
