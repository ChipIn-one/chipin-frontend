import styled from 'styled-components';

import { Flex, Grid, Switch, Text } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

interface Props {
    payerNode: React.ReactNode;
    isIncludedInSolo: boolean;
    soloLabel: string;
    onSoloChange: (value: boolean) => void;
}

const SoloBox = styled.label`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-width: 0;
    min-height: 52px;
    padding: 0 var(--space-3);
    border: 1px solid ${themeColor('gray6')};
    border-radius: var(--radius-4);
    cursor: pointer;
`;

const ExpensePayerSoloSection = ({
    payerNode,
    isIncludedInSolo,
    soloLabel,
    onSoloChange,
}: Props) => {
    return (
        <Grid columns={{ initial: '1', sm: '2' }} gap="3">
            {payerNode}

            <SoloBox>
                <Flex direction="column" minWidth="0">
                    <Text as="span" size="2" weight="medium" truncate>
                        {soloLabel}
                    </Text>
                </Flex>
                <Switch size="1" checked={isIncludedInSolo} onCheckedChange={onSoloChange} />
            </SoloBox>
        </Grid>
    );
};

export default ExpensePayerSoloSection;
