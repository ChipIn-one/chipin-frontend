import { Dialog, IconButton, Text, VisuallyHidden } from '@radix-ui/themes';
import { ArrowLeftIcon, XIcon } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { OverlayHeader } from '../components';

import { MODAL_SIZES, type ModalSize } from './constants';

// NET-003: the top layer (toasts, the update-required screen) is above the modal and operable;
// pressing it is not a click outside the modal (closing would drop the expense draft of a reload).
const keepOpenOnTopLayer = (event: Event): void => {
    if (event.target instanceof Element && event.target.closest('[data-top-layer]')) {
        event.preventDefault();
    }
};

interface Props {
    triggerElement?: ReactNode;
    content: ReactNode;
    title: string;
    accessibleDescription: string;
    maxWidth?: ModalSize;
    isOpened?: boolean;
    setIsOpened?: (isOpen: boolean) => void;
    isCloseDisabled?: boolean;
    onBack?: () => void;
    isBackDisabled?: boolean;
    titleRef?: Ref<HTMLHeadingElement>;
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
    onBack,
    isBackDisabled = false,
    titleRef,
}: Props) => {
    const { t } = useTranslation('common');

    return (
        <Dialog.Root open={isOpened} onOpenChange={setIsOpened}>
            {triggerElement && <Dialog.Trigger>{triggerElement}</Dialog.Trigger>}

            <Dialog.Content
                maxWidth={maxWidth}
                size={{ initial: '2', sm: '4' }}
                className="modal-overlay-content"
                onInteractOutside={keepOpenOnTopLayer}
            >
                <OverlayHeader
                    backControl={
                        onBack ? (
                            <IconButton
                                type="button"
                                variant="ghost"
                                color="gray"
                                aria-label={t('buttons.back')}
                                disabled={isBackDisabled}
                                onClick={onBack}
                            >
                                <ArrowLeftIcon width={20} />
                            </IconButton>
                        ) : undefined
                    }
                    title={
                        <Dialog.Title
                            ref={titleRef}
                            tabIndex={titleRef ? -1 : undefined}
                            size="6"
                            mb="0"
                        >
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
                                <XIcon width={24} />
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
