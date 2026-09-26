import { FC, ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { BaseProps } from '../duck/types';

import { getAmountData, getAmountTypesBool } from './duck/selectors';
import { AmountTypes, ClickFuncParams } from './duck/types';

const Wrapper = styled.span`
    display: inline-block;
    white-space: nowrap;
`;

interface Props extends BaseProps {
    type?: AmountTypes;
    isAbsolute?: boolean;
    tokenCode?: string | ReactNode; // ReactNode use only <span> with styles
    customPrefix?: string;
    customPrefixTooSmall?: string;
    className?: string;
    onClick?: (params: ClickFuncParams) => void;
}

const Amount: FC<Props> = ({
    value,
    tokenCode,
    precision,
    symbol,
    type = 'default',
    isAbsolute = true,
    customPrefix,
    customPrefixTooSmall,
    className,
    onClick,
}) => {
    const { t } = useTranslation('common');
    const { isInteger } = getAmountTypesBool(type);

    const { amountPart, amountString, bigAmount, postfix, prefixLess, prefixSymbol, zerosPart } =
        useMemo(
            () =>
                getAmountData({
                    precision,
                    symbol,
                    tokenCode,
                    type,
                    isAbsolute,
                    value,
                    customPrefixTooSmall,
                }),
            [value, precision, symbol, tokenCode, type, isAbsolute, customPrefixTooSmall],
        );

    if (isInteger && !Number.isInteger(value)) {
        return t('amount.notInteger');
    }

    return (
        <Wrapper
            className={className}
            onClick={onClick && (() => onClick({ amountString, bigAmount }))}
        >
            {prefixLess}
            <span dir="ltr">{customPrefix || prefixSymbol}</span>
            {amountPart}
            <span>{zerosPart}</span>
            {postfix && <> {postfix}</>}
        </Wrapper>
    );
};

export default Amount;
