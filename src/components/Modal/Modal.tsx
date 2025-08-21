import { LucideX } from 'lucide-react';

import { Box, Dialog, Flex, IconButton } from '@radix-ui/themes';

interface Props {
    triggerElement: React.ReactNode;
    content: React.ReactNode;
    maxWidth?: string;
}

const BaseModal = ({ triggerElement, maxWidth = '360px', content }: Props) => {
    return (
        <Dialog.Root>
            <Dialog.Trigger>{triggerElement}</Dialog.Trigger>

            <Dialog.Content maxWidth={maxWidth} size="4">
                <Dialog.Title size="8">
                    <Flex justify="between" align="center">
                        <Box>Sign in</Box>
                        <Dialog.Close>
                            <IconButton variant="ghost" color="jade">
                                <LucideX width={24} />
                            </IconButton>
                        </Dialog.Close>
                    </Flex>
                </Dialog.Title>

                <Flex direction="column" gap="6">
                    <Dialog.Description size="4">Choose a provider to continue</Dialog.Description>
                    {content}
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export default BaseModal;
