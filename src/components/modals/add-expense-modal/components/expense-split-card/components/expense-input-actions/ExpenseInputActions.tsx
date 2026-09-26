import { LucideMinus, LucidePlus } from 'lucide-react';
import type { ChangeEvent } from 'react';

import { Flex, IconButton } from '@radix-ui/themes';

import { InputRoot } from './styled';

interface Props {
    value: string;
    inputMode: 'decimal' | 'numeric';
    isDisabled?: boolean;
    stepSize?: number;
    minLabel: string;
    plusLabel: string;
    onChange: (value: string) => void;
    onStep: (delta: number) => void;
}

const ExpenseInputActions = ({
    value,
    inputMode,
    isDisabled = false,
    stepSize = 1,
    minLabel,
    plusLabel,
    onChange,
    onStep,
}: Props) => {
    const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        onChange(event.target.value);
    };
    const decrementLabel = `${minLabel} ${stepSize}`;
    const incrementLabel = `${plusLabel} ${stepSize}`;

    return (
        <Flex align="center" justify="end" gap="1" width="100%">
            <IconButton
                size="3"
                variant="soft"
                color="gray"
                disabled={isDisabled}
                onClick={() => onStep(-1)}
                aria-label={decrementLabel}
            >
                <LucideMinus size={16} />
            </IconButton>
            <InputRoot
                value={value}
                onChange={onInputChange}
                inputMode={inputMode}
                disabled={isDisabled}
                size="3"
            />
            <IconButton
                size="3"
                variant="soft"
                color="gray"
                disabled={isDisabled}
                onClick={() => onStep(1)}
                aria-label={incrementLabel}
            >
                <LucidePlus size={16} />
            </IconButton>
        </Flex>
    );
};

export default ExpenseInputActions;
