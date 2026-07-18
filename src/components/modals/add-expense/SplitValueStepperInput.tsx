import { ChangeEvent } from 'react';
import { LucideMinus, LucidePlus } from 'lucide-react';
import styled from 'styled-components';

import { Flex, IconButton, Text, TextField } from '@radix-ui/themes';

const InputRoot = styled(TextField.Root)<{ $isCompact: boolean }>`
    width: ${({ $isCompact }) => ($isCompact ? '72px' : '96px')};
    flex: none;

    input {
        text-align: center;
        font-variant-numeric: tabular-nums;
    }
`;

const UnitText = styled(Text)`
    width: 16px;
    flex: none;
    text-align: left;
`;

interface Props {
    value: string;
    unit?: string;
    inputMode: 'decimal' | 'numeric';
    isDisabled?: boolean;
    stepSize?: number;
    minLabel: string;
    plusLabel: string;
    onChange: (value: string) => void;
    onStep: (delta: number) => void;
}

const SplitValueStepperInput = ({
    value,
    unit,
    inputMode,
    isDisabled = false,
    stepSize = 1,
    minLabel,
    plusLabel,
    onChange,
    onStep,
}: Props) => {
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        onChange(event.target.value);
    };
    const stepUnit = unit ?? '';
    const decrementLabel = `${minLabel} ${stepSize}${stepUnit}`;
    const incrementLabel = `${plusLabel} ${stepSize}${stepUnit}`;

    return (
        <Flex align="center" gap="1">
            <IconButton
                size="1"
                variant="soft"
                color="gray"
                disabled={isDisabled}
                onClick={() => onStep(-1)}
                aria-label={decrementLabel}
            >
                <LucideMinus size={12} />
            </IconButton>
            <InputRoot
                $isCompact={Boolean(unit)}
                value={value}
                onChange={handleChange}
                inputMode={inputMode}
                disabled={isDisabled}
                size="1"
            />
            {unit ? (
                <UnitText as="span" size="1" color="gray">
                    {unit}
                </UnitText>
            ) : null}
            <IconButton
                size="1"
                variant="soft"
                color="gray"
                disabled={isDisabled}
                onClick={() => onStep(1)}
                aria-label={incrementLabel}
            >
                <LucidePlus size={12} />
            </IconButton>
        </Flex>
    );
};

export default SplitValueStepperInput;
