import styled, { css, keyframes } from 'styled-components';

const backendUnavailableSpin = keyframes`
    to {
        transform: rotate(360deg);
    }
`;

const AppContent = styled.div<{ $isUnavailable: boolean }>`
    ${({ $isUnavailable }) =>
        $isUnavailable &&
        css`
            pointer-events: none;
            user-select: none;
        `}
`;

const BackendUnavailableSurface = styled.main`
    position: fixed;
    z-index: 1000;
    inset: 0;
    display: grid;
    width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
    box-sizing: border-box;
    place-items: center;
    overflow: auto;
    padding: clamp(20px, 5vw, 40px);
    color: CanvasText;
    background: color-mix(in srgb, Canvas 88%, transparent);
`;

const BackendUnavailablePanel = styled.section`
    width: min(100%, 620px);
    box-sizing: border-box;
    padding: clamp(28px, 6vw, 56px);
    border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
    border-radius: 18px;
    background: color-mix(in srgb, Canvas 96%, transparent);
    box-shadow: 0 18px 56px color-mix(in srgb, CanvasText 14%, transparent);
    text-align: center;
`;

const BackendUnavailableIcon = styled.div`
    display: grid;
    width: 72px;
    height: 72px;
    margin: 0 auto 18px;
    place-items: center;
    border-radius: 50%;
    color: var(--amber-11, #8f4f00);
    background: color-mix(in srgb, var(--amber-9, #f59e0b) 14%, transparent);
`;

const BackendUnavailableEyebrow = styled.p`
    margin: 0 0 10px;
    color: var(--amber-11, #8f4f00);
    font-size: 20px;
    font-weight: 700;
`;

const BackendUnavailableTitle = styled.h1`
    margin: 0;
    font-size: clamp(26px, 5vw, 38px);
    line-height: 1.15;
`;

const BackendUnavailableDescription = styled.p`
    max-width: 48ch;
    margin: 20px auto 0;
    color: color-mix(in srgb, CanvasText 72%, transparent);
    font-size: 17px;
    line-height: 1.5;
`;

const BackendUnavailableActions = styled.div`
    display: flex;
    justify-content: center;
    margin-top: 32px;
`;

const BackendUnavailableButton = styled.button<{ $isLoading: boolean }>`
    display: inline-flex;
    width: 260px;
    max-width: 100%;
    min-height: 54px;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 0 24px;
    border: 1px solid CanvasText;
    border-radius: 10px;
    cursor: pointer;
    color: Canvas;
    background: CanvasText;
    font: inherit;
    font-weight: 650;

    ${({ $isLoading }) =>
        $isLoading &&
        css`
            svg {
                animation: ${backendUnavailableSpin} 0.8s linear infinite;
            }
        `}

    &:focus-visible {
        outline: 3px solid AccentColor;
        outline-offset: 3px;
    }

    &:disabled {
        cursor: wait;
        opacity: 0.6;
    }
`;

const BackendUnavailableRetryMessage = styled.p<{ $visible: boolean }>`
    margin: 18px 0 0;
    visibility: ${({ $visible }) => ($visible ? 'visible' : 'hidden')};
    color: var(--amber-11, #8f4f00);
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
    BackendUnavailableSurface,
    BackendUnavailableTitle,
};
