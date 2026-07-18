import { LucideX } from 'lucide-react';

import { Dialog, Flex, IconButton, Separator, Text } from '@radix-ui/themes';

import { MODAL_SIZES, type ModalSize } from './constants';

// Mobile fullscreen styles live in src/styles/radixStylesOverwrite.css
// (the project-wide designated file for Radix style overrides).

interface Props {
    triggerElement?: React.ReactNode;
    content: React.ReactNode;
    title: string;
    description?: string;
    maxWidth?: ModalSize;
    isOpened?: boolean;
    setIsOpened?: (isOpen: boolean) => void;
}

const BaseModal = ({
    triggerElement,
    title,
    description,
    maxWidth = MODAL_SIZES.default,
    content,
    isOpened,
    setIsOpened,
}: Props) => {
    return (
        <Dialog.Root open={isOpened} onOpenChange={setIsOpened}>
            {triggerElement && <Dialog.Trigger>{triggerElement}</Dialog.Trigger>}

            <Dialog.Content
                maxWidth={maxWidth}
                size={{ initial: '2', sm: '4' }}
                className="base-modal-content"
            >
                <Dialog.Title size="6">
                    <Flex justify="between" align="center">
                        <Text color="gray">{title}</Text>

                        <Dialog.Close>
                            <IconButton variant="ghost" color="jade">
                                <LucideX width={24} />
                            </IconButton>
                        </Dialog.Close>
                    </Flex>
                </Dialog.Title>
                <Separator orientation="horizontal" size="4" />

                <Flex direction="column" mt="6" className="base-modal-body">
                    {description && <Dialog.Description size="4">{description}</Dialog.Description>}

                    {content}
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export default BaseModal;
