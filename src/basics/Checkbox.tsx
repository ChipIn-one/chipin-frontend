import { type ComponentProps } from 'react';

import { Checkbox as RadixCheckbox } from '@radix-ui/themes';

type Props = ComponentProps<typeof RadixCheckbox>;

const Checkbox = ({
    color = 'jade',
    size = '2',
    ...checkboxProps
}: Props) => {
    return (
        <RadixCheckbox
            {...checkboxProps}
            color={color}
            size={size}
        />
    );
};

export default Checkbox;
