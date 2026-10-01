import styled, { css } from 'styled-components';

import { Dialog } from '@radix-ui/themes';

const ModalContent = styled(Dialog.Content)<{ $constrainBodyScroll: boolean }>`
    ${({ $constrainBodyScroll }) =>
        $constrainBodyScroll &&
        css`
            display: flex;
            max-height: calc(100dvh - var(--space-6) - max(var(--space-6), 6vh));
            flex-direction: column;
            overflow: hidden;
        `}
`;

export { ModalContent };
