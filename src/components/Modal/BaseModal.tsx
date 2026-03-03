import { LucideX } from 'lucide-react';

import { Box, Dialog, Flex, IconButton, Text } from '@radix-ui/themes';

interface Props {
    triggerElement: React.ReactNode;
    content: React.ReactNode;
    title: string;
    description?: string;
    maxWidth?: string;
    isOpened?: boolean;
    setIsOpened?: (isOpen: boolean) => void;
}

const BaseModal = ({
    triggerElement,
    title,
    description,
    maxWidth = '360px',
    content,
    isOpened,
    setIsOpened,
}: Props) => {
    return (
        <Dialog.Root open={isOpened} onOpenChange={setIsOpened}>
            <Dialog.Trigger>{triggerElement}</Dialog.Trigger>

            <Dialog.Content maxWidth={maxWidth} size="4">
                <Dialog.Title size="6">
                    <Flex justify="between" align="center">
                        <Box>{title}</Box>
                        <Dialog.Close>
                            <IconButton variant="ghost" color="jade">
                                <LucideX width={24} />
                            </IconButton>
                        </Dialog.Close>
                    </Flex>
                </Dialog.Title>

                <Flex direction="column" gap="6">
                    <Dialog.Description size="4">
                        <Text>{description}</Text>
                    </Dialog.Description>

                    {content}
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export default BaseModal;
