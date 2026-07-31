import { LucideX } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Dialog, IconButton, Text, VisuallyHidden } from '@radix-ui/themes';

import { OverlayHeader } from '../components';

import { MODAL_SIZES, type ModalSize } from './constants';

interface Props {
    triggerElement?: ReactNode;
    content: ReactNode;
    title: string;
    accessibleDescription: string;
    maxWidth?: ModalSize;
    isOpened?: boolean;
    setIsOpened?: (isOpen: boolean) => void;
}

const BaseModal = ({
    triggerElement,
    title,
    accessibleDescription,
    maxWidth = MODAL_SIZES.default,
    content,
    isOpened,
    setIsOpened,
}: Props) => {
    const { t } = useTranslation('common');

    return (
        <Dialog.Root open={isOpened} onOpenChange={setIsOpened}>
            {triggerElement && <Dialog.Trigger>{triggerElement}</Dialog.Trigger>}

            <Dialog.Content
                maxWidth={maxWidth}
                size={{ initial: '2', sm: '4' }}
                className="modal-overlay-content"
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
                                color="jade"
                                aria-label={t('buttons.close')}
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
            </Dialog.Content>
        </Dialog.Root>
    );
};

export default BaseModal;
