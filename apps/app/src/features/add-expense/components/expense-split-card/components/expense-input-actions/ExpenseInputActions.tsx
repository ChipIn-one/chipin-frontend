import { PROP_COLOR } from '@chipin/tokens/theme';
import { Flex, IconButton, TextField } from '@radix-ui/themes';
import { MinusIcon, PlusIcon } from 'lucide-react';
import type { ChangeEvent } from 'react';

import styles from './ExpenseInputActions.module.css';

interface Props {
    value: string;
    inputMode: 'decimal' | 'numeric';
    isDisabled?: boolean;
    stepSize?: number;
    inputLabel: string;
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
    inputLabel,
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
                color={PROP_COLOR.neutral}
                disabled={isDisabled}
                onClick={() => onStep(-1)}
                aria-label={decrementLabel}
            >
                <MinusIcon size={16} />
            </IconButton>
            <TextField.Root
                className={styles.input}
                value={value}
                onChange={onInputChange}
                inputMode={inputMode}
                disabled={isDisabled}
                aria-label={inputLabel}
                size="3"
            />
            <IconButton
                size="3"
                variant="soft"
                color={PROP_COLOR.neutral}
                disabled={isDisabled}
                onClick={() => onStep(1)}
                aria-label={incrementLabel}
            >
                <PlusIcon size={16} />
            </IconButton>
        </Flex>
    );
};

export { ExpenseInputActions };
