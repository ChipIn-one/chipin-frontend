import { AmountInput } from 'basics';
import styled from 'styled-components';

import { Text, TextField } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

interface Props {
    amount: string;
    description: string;
    amountLabel: string;
    descriptionPlaceholder: string;
    onAmountChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
}

const AmountBox = styled.div`
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    padding: var(--space-4);
    border: 2px solid ${themeColor('jade8')};
    border-radius: var(--radius-5);
`;

const LargeAmountInput = styled(AmountInput)`
    --text-field-border-width: 0px;
    --text-field-focus-color: transparent;
    background: transparent !important;
    box-shadow: none !important;
    height: auto;
    outline: none !important;
    padding: 0;

    &:focus-within {
        box-shadow: none !important;
        outline: none !important;
    }

    & input {
        background: transparent;
        height: auto;
        padding: 0;
        font-size: var(--font-size-8);
        font-weight: 700;
        line-height: 1.05;
        text-indent: 0;
    }
`;

const DescriptionInput = styled(TextField.Root)`
    --text-field-border-width: 0px;
    --text-field-focus-color: transparent;
    background: transparent !important;
    box-shadow: none !important;
    height: auto;
    outline: none !important;
    padding: 0;

    &:focus-within {
        box-shadow: none !important;
        outline: none !important;
    }

    & input {
        background: transparent;
        height: auto;
        padding: 0;
        color: ${themeColor('gray11')};
        text-indent: 0;
    }
`;

const ExpenseModalTopSection = ({
    amount,
    description,
    amountLabel,
    descriptionPlaceholder,
    onAmountChange,
    onDescriptionChange,
}: Props) => {
    return (
        <AmountBox>
            <Text as="label" size="2" weight="bold" color="gray">
                {amountLabel}
            </Text>

            <LargeAmountInput
                value={amount}
                onChange={onAmountChange}
                color="gray"
                size="3"
                autoFocus
            />

            <DescriptionInput
                type="text"
                size="3"
                variant="surface"
                placeholder={descriptionPlaceholder}
                value={description}
                onChange={event => onDescriptionChange(event.target.value)}
            />
        </AmountBox>
    );
};

export default ExpenseModalTopSection;
