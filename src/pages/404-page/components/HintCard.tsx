import type { ReactNode } from 'react';

import { Flex, Text } from '@radix-ui/themes';

interface HintCardProps {
    icon: ReactNode;
    title: string;
    description: string;
}

const HintCard = ({ icon, title, description }: HintCardProps) => (
    <Flex direction="row" align="center" gap="3">
        <Flex align="center" justify="center" flexShrink="0">
            {icon}
        </Flex>
        <Flex direction="column" gap="1">
            <Text size="2" weight="bold">
                {title}
            </Text>
            <Text size="1" color="gray">
                {description}
            </Text>
        </Flex>
    </Flex>
);

export default HintCard;
