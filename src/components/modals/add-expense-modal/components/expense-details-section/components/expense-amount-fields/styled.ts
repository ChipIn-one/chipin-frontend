import { AmountInput } from 'basics';
import styled from 'styled-components';

import { TextField } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

export const AmountBox = styled.div`
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    padding: var(--space-4);
    border: 2px solid ${themeColor('jade8')};
    border-radius: var(--radius-5);
`;

export const LargeAmountInput = styled(AmountInput)`
    --text-field-border-width: 0px;
    --text-field-focus-color: transparent;
    height: auto;
    padding: 0;
    background: transparent !important;
    box-shadow: none !important;
    outline: none !important;

    &:focus-within {
        box-shadow: none !important;
        outline: none !important;
    }

    & input {
        height: auto;
        padding: 0;
        background: transparent;
        font-size: var(--font-size-8);
        font-weight: 700;
        line-height: 1.05;
        text-indent: 0;
    }
`;

export const DescriptionInput = styled(TextField.Root)`
    --text-field-border-width: 0px;
    --text-field-focus-color: transparent;
    height: auto;
    padding: 0;
    background: transparent !important;
    box-shadow: none !important;
    outline: none !important;

    &:focus-within {
        box-shadow: none !important;
        outline: none !important;
    }

    & input {
        height: auto;
        padding: 0;
        background: transparent;
        color: ${themeColor('gray11')};
        text-indent: 0;
    }
`;
