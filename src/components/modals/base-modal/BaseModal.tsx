import { LucideX } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Dialog, IconButton, Text, VisuallyHidden } from '@radix-ui/themes';

import { OverlayHeader } from '../components';

import { MODAL_SIZES, type ModalSize } from './constants';
import { ModalContent } from './styled';

interface Props {
    triggerElement?: ReactNode;
    content: ReactNode;
    title: string;
    accessibleDescription: string;
    maxWidth?: ModalSize;
    isOpened?: boolean;
    setIsOpened?: (isOpen: boolean) => void;
    isCloseDisabled?: boolean;
    constrainBodyScroll?: boolean;
}

const BaseModal = ({
    triggerElement,
    title,
    accessibleDescription,
    maxWidth = MODAL_SIZES.default,
    content,
    isOpened,
    setIsOpened,
    isCloseDisabled = false,
    constrainBodyScroll = false,
}: Props) => {
    const { t } = useTranslation('common');

    return (
        <Dialog.Root open={isOpened} onOpenChange={setIsOpened}>
            {triggerElement && <Dialog.Trigger>{triggerElement}</Dialog.Trigger>}

            <ModalContent
                maxWidth={maxWidth}
                size={{ initial: '2', sm: '4' }}
                className="modal-overlay-content"
                $constrainBodyScroll={constrainBodyScroll}
            >
                <OverlayHeader
                    title={
                        <Dialog.Title size="6" mb="0">
                            <Text color="gray">{title}</Text>
                        </Dialog.Title>
                    }
                    closeControl={
                        <Dialog.Close>
                            <IconButton
                                variant="ghost"
                                color="grass"
                                aria-label={t('buttons.close')}
                                disabled={isCloseDisabled}
                            >
                                <LucideX width={24} />
                            </IconButton>
                        </Dialog.Close>
                    }
                />
                <VisuallyHidden>
                    <Dialog.Description>{accessibleDescription}</Dialog.Description>
                </VisuallyHidden>
                {content}
            </ModalContent>
        </Dialog.Root>
    );
};

export default BaseModal;
