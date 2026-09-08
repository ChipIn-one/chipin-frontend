import { type ComponentProps } from 'react';

import { Progress } from '@radix-ui/themes';

import { PROGRESS_MAX } from './constants';

interface Props extends Omit<ComponentProps<typeof Progress>, 'value'> {
    value: number;
}

const ProgressBar = ({
    value,
    max = PROGRESS_MAX,
    size = '1',
    radius = 'full',
    ...progressProps
}: Props) => {
    const normalizedValue = Math.min(Math.max(value, 0), max);

    return (
        <Progress
            {...progressProps}
            value={normalizedValue}
            max={max}
            size={size}
            radius={radius}
        />
    );
};

export default ProgressBar;
