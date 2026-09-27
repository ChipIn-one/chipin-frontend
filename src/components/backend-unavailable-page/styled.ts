import styled, { css } from 'styled-components';

import { Button, Dialog } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

const AppContent = styled.div<{ $isUnavailable: boolean }>`
    ${({ $isUnavailable }) =>
        $isUnavailable &&
        css`
            pointer-events: none;
            user-select: none;
        `}
`;

const BackendUnavailablePanel = styled(Dialog.Content)`
    width: min(calc(100vw - (var(--space-4) * 2)), 620px);
    max-width: 620px;
    max-height: calc(100dvh - (var(--space-4) * 2));
    box-sizing: border-box;
    overflow: auto;
    padding: clamp(28px, 6vw, 56px);
    border: 1px solid ${themeColor('grayA6')};
    border-radius: var(--radius-5);
    background-color: ${themeColor('gray1')};
    box-shadow: 0 18px 56px ${themeColor('grayA6')};
    text-align: center;
`;

const BackendUnavailableIcon = styled.div`
    display: grid;
    width: 72px;
    height: 72px;
    margin: 0 auto 18px;
    place-items: center;
    border-radius: 50%;
    color: ${themeColor('amber11')};
    background-color: ${themeColor('amberA3')};
`;

const BackendUnavailableEyebrow = styled.p`
    margin: 0 0 10px;
    color: ${themeColor('amber11')};
    font-size: 20px;
    font-weight: 700;
`;

const BackendUnavailableTitle = styled(Dialog.Title)`
    margin: 0;
    font-size: clamp(26px, 5vw, 38px);
    line-height: 1.15;
`;

const BackendUnavailableDescription = styled(Dialog.Description)`
    max-width: 48ch;
    margin: 20px auto 0;
    color: ${themeColor('gray11')};
    font-size: 17px;
    line-height: 1.5;
`;

const BackendUnavailableActions = styled.div`
    display: flex;
    justify-content: center;
    margin-top: 32px;
`;

const BackendUnavailableButton = styled(Button)`
    min-width: 180px;
    max-width: 100%;
`;

const BackendUnavailableRetryMessage = styled.p<{ $visible: boolean }>`
    margin: 18px 0 0;
    visibility: ${({ $visible }) => ($visible ? 'visible' : 'hidden')};
    color: ${themeColor('amber11')};
    font-size: 15px;
    line-height: 1.4;
`;

export {
    AppContent,
    BackendUnavailableActions,
    BackendUnavailableButton,
    BackendUnavailableDescription,
    BackendUnavailableEyebrow,
    BackendUnavailableIcon,
    BackendUnavailablePanel,
    BackendUnavailableRetryMessage,
    BackendUnavailableTitle,
};
