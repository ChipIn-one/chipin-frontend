import { Box, Button, Dialog, Flex } from '@radix-ui/themes';

interface Props {
    triggerElement: React.ReactNode;
    content: React.ReactNode;
    maxWidth?: string;
}

const BaseModal = ({ triggerElement, maxWidth = '360px', content }: Props) => {
    return (
        <Dialog.Root>
            <Dialog.Trigger>{triggerElement}</Dialog.Trigger>

            <Dialog.Content maxWidth={maxWidth}>
                <Dialog.Title size="4">
                    <Flex justify="between">
                        <Box>Sign in</Box>
                        <Dialog.Close>
                            <Button variant="outline" color="gray">
                                X
                            </Button>
                        </Dialog.Close>
                    </Flex>
                </Dialog.Title>

                <Dialog.Description size="4">Choose a provider to continue</Dialog.Description>

                {content}
            </Dialog.Content>
        </Dialog.Root>
    );
};

export default BaseModal;
