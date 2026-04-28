import { Text } from '@radix-ui/themes';

import { formatRelativeTime } from 'helpers/time';

interface Props {
    createdAt: number;
}

const RelativeTime = ({ createdAt }: Props) => {
    return (
        <Text size="2" color="gray" as="span" align="right">
            {formatRelativeTime(createdAt)}
        </Text>
    );
};

export default RelativeTime;
