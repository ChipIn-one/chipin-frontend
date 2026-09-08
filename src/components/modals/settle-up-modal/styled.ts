import { AmountInput } from 'basics';
import styled from 'styled-components';

import { Button, Card, ScrollArea, Text } from '@radix-ui/themes';

import { MEDIA_QUERIES } from 'constants/breakpoints';

export const DebtSelectionScrollArea = styled(ScrollArea)`
    height: auto;
    max-height: min(60dvh, 640px);

    & [data-radix-scroll-area-viewport] {
        height: auto;
        max-height: inherit;
    }

    & [data-radix-scroll-area-viewport] > div {
        width: 100%;
        min-width: 0 !important;
    }

    @media ${MEDIA_QUERIES.belowSm} {
        max-height: none;
    }
`;

export const ModalSurface = styled.div`
    display: flex;
    min-height: 100%;
    flex-direction: column;
    gap: var(--space-4);
`;

export const LargeAmountInput = styled(AmountInput)`
    width: 100%;
    height: 72px;
    align-items: center;
    box-shadow: none;

    & input {
        height: 100%;
        padding: 0 var(--space-3);
        text-align: center;
        font-size: var(--font-size-8);
        font-weight: 700;
        line-height: 1;
    }
`;

export const AmountField = styled.div`
    min-width: 0;
    flex: 1;
`;

export const CurrencyField = styled.div`
    display: flex;
    min-width: 96px;
    align-items: stretch;

    & > button {
        width: 100%;
        height: 72px;
        justify-content: center;
        font-size: var(--font-size-5);
        font-weight: 700;
    }
`;

export const StaticCurrencyField = styled(Card)`
    display: flex;
    min-width: 96px;
    height: 72px;
    align-items: center;
    justify-content: center;
`;

export const ParticipantName = styled(Text)`
    min-width: 0;
    max-width: 100%;
    overflow-wrap: anywhere;
    text-align: left;
    white-space: normal;
`;

export const DebtAmount = styled(Text)`
    flex-shrink: 0;
`;

export const DebtButton = styled(Button)`
    width: 100%;
    height: auto;
    justify-content: stretch;
    padding-block: var(--space-3);
    white-space: normal;
`;

export const ShowMoreButton = styled(Button)`
    align-self: center;
`;
