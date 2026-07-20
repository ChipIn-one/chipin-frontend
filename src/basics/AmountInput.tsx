import { ComponentProps } from 'react';

import { TextField } from '@radix-ui/themes';

import { parseAmountInput } from 'helpers/numbers';

type TextFieldRootProps = ComponentProps<typeof TextField.Root>;

interface Props extends Omit<TextFieldRootProps, 'onChange' | 'type' | 'inputMode'> {
    onChange: (value: string) => void;
    maxFractionDigits?: number | null;
}

const AmountInput = ({
    value,
    onChange,
    maxFractionDigits = 2,
    placeholder = '0.00',
    className,
    ...rest
}: Props) => {
    const onValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const parsed = parseAmountInput(event.target.value, maxFractionDigits);

        if (parsed !== null) {
            onChange(parsed);
        }
    };

    return (
        <TextField.Root
            {...rest}
            className={className}
            type="text"
            inputMode="decimal"
            placeholder={placeholder}
            value={value}
            onChange={onValueChange}
        />
    );
};

export default AmountInput;
