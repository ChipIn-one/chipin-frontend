import { type ComponentProps, type MouseEvent, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AlertDialog, Button, Flex, Text } from '@radix-ui/themes';

import {
    MODAL_SIZES,
    type ModalSize,
    OverlayBody,
    OverlayFooter,
    OverlayHeader,
} from '../components';

interface Props {
    triggerElement?: ReactNode;
    content?: ReactNode;
    title: string;
    description: string;
    actionLabel: string;
    actionColor: ComponentProps<typeof Button>['color'];
    isActionDisabled?: boolean;
    isActionLoading?: boolean;
    isOpened: boolean;
    setIsOpened: (isOpen: boolean) => void;
    maxWidth?: ModalSize;
    onAction: () => Promise<void>;
}

const BaseAlertDialog = ({
    triggerElement,
    content,
    title,
    description,
    actionLabel,
    actionColor,
    isActionDisabled = false,
    isActionLoading = false,
    isOpened,
    setIsOpened,
    maxWidth = MODAL_SIZES.default,
    onAction,
}: Props) => {
    const { t } = useTranslation('common');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isPending = isSubmitting || isActionLoading;

    const onOpenChange = (isOpen: boolean) => {
        if (!isOpen && isPending) {
            return;
        }

        setIsOpened(isOpen);
    };

    const onActionClick = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();

        if (isPending || isActionDisabled) {
            return;
        }

        setIsSubmitting(true);
        onAction()
            .then(
                () => {
                    setIsOpened(false);
                },
                () => {
                    // The action owns its user-facing error; keep the dialog open.
                },
            )
            .finally(() => {
                setIsSubmitting(false);
            });
    };

    return (
        <AlertDialog.Root open={isOpened} onOpenChange={onOpenChange}>
            {triggerElement && <AlertDialog.Trigger>{triggerElement}</AlertDialog.Trigger>}

            <AlertDialog.Content
                maxWidth={maxWidth}
                size={{ initial: '2', sm: '4' }}
                className="modal-overlay-content"
                onEscapeKeyDown={event => event.preventDefault()}
            >
                <OverlayHeader
                    title={
                        <AlertDialog.Title size="6" mb="0">
                            <Text color="gray">{title}</Text>
                        </AlertDialog.Title>
                    }
                />

                <OverlayBody>
                    <Flex direction="column" gap="4">
                        <AlertDialog.Description size="4">{description}</AlertDialog.Description>
                        {content}
                    </Flex>
                </OverlayBody>

                <OverlayFooter
                    cancelAction={
                        <AlertDialog.Cancel>
                            <Button
                                size="3"
                                variant="soft"
                                color="gray"
                                disabled={isPending}
                            >
                                {t('buttons.cancel')}
                            </Button>
                        </AlertDialog.Cancel>
                    }
                    primaryAction={
                        <AlertDialog.Action>
                            <Button
                                size="3"
                                variant="solid"
                                color={actionColor}
                                disabled={isPending || isActionDisabled}
                                loading={isPending}
                                onClick={onActionClick}
                            >
                                {actionLabel}
                            </Button>
                        </AlertDialog.Action>
                    }
                />
            </AlertDialog.Content>
        </AlertDialog.Root>
    );
};

export default BaseAlertDialog;
