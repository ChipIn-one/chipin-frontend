import { ComponentProps } from 'react';

import { TextField } from '@radix-ui/themes';

import { parseAmountInput } from 'helpers/numbers';

type TextFieldRootProps = ComponentProps<typeof TextField.Root>;

interface Props extends Omit<TextFieldRootProps, 'onChange' | 'type' | 'inputMode'> {
    onChange: (value: string) => void;
}

const AmountInput = ({ value, onChange, placeholder = '0.00', className, ...rest }: Props) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const parsed = parseAmountInput(event.target.value);

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
            onChange={handleChange}
        />
    );
};

export default AmountInput;
