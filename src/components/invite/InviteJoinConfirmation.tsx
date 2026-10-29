import { Box, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';

import type { InviteConfirmationStatus } from 'hooks/useInviteConfirmation';

interface Props {
    status: InviteConfirmationStatus;
    errorMessage?: string;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    retryLabel: string;
    invalidTitle: string;
    goHomeLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
}

// The primary button never gets autoFocus: Enter or a double tap right after the
// screen opens must not join before the user has read it.
const InviteJoinConfirmation = ({
    status,
    errorMessage,
    title,
    description,
    confirmLabel,
    cancelLabel,
    retryLabel,
    invalidTitle,
    goHomeLabel,
    onConfirm,
    onCancel,
}: Props) => {
    const isInvalid = status === 'invalid';
    const isError = status === 'error';

    return (
        <Flex justify="center" px="4">
            <Box width="100%" maxWidth="480px">
                <Card size="3">
                    <Flex direction="column" gap="4">
                        <Heading as="h1" size="5">{isInvalid ? invalidTitle : title}</Heading>
                        {!isInvalid && <Text as="p" color="gray">{description}</Text>}
                        {isError && <Text as="p" color="red" role="alert">{errorMessage}</Text>}
                        <Flex justify="end" gap="3" wrap="wrap">
                            {isInvalid ? (
                                <Button type="button" onClick={onCancel}>{goHomeLabel}</Button>
                            ) : (
                                <>
                                    <Button type="button" variant="soft" color="gray" onClick={onCancel}>
                                        {isError ? goHomeLabel : cancelLabel}
                                    </Button>
                                    <Button type="button" loading={status === 'joining'} onClick={onConfirm}>
                                        {isError ? retryLabel : confirmLabel}
                                    </Button>
                                </>
                            )}
                        </Flex>
                    </Flex>
                </Card>
            </Box>
        </Flex>
    );
};

export default InviteJoinConfirmation;
