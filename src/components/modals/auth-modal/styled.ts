import styled from 'styled-components';

import { Heading } from '@radix-ui/themes';

import { MEDIA_QUERIES } from 'constants/breakpoints';

const AuthBody = styled.div`
    display: flex;
    min-width: 0;
    min-height: 0;
    box-sizing: border-box;
    padding: var(--space-6) var(--space-5);

    @media ${MEDIA_QUERIES.belowSm} {
        flex: 1;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding:
            var(--space-3) calc(var(--space-4) + env(safe-area-inset-right))
            calc(var(--space-4) + env(safe-area-inset-bottom))
            calc(var(--space-4) + env(safe-area-inset-left));
    }
`;

const AuthLayout = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-5);
    width: 100%;
    max-width: 420px;
    margin: 0 auto;

    @media ${MEDIA_QUERIES.belowSm} {
        flex: 1;
        min-height: 100%;
        gap: var(--space-4);
    }
`;

const HeroIllustration = styled.div.attrs({ 'aria-hidden': true })`
    position: relative;
    flex-shrink: 0;
    width: min(100%, 260px);
    height: 180px;

    @media ${MEDIA_QUERIES.belowSm} {
        height: clamp(136px, 25dvh, 180px);
    }
`;

const ReceiptNode = styled.div`
    position: absolute;
    z-index: 2;
    top: 52%;
    left: 50%;
    display: grid;
    width: 88px;
    height: 104px;
    transform: translate(-50%, -50%);
    place-items: center;
    color: var(--grass-9);
    background: var(--color-panel-solid);
    border: 1px solid var(--gray-a6);
    border-radius: var(--radius-4);
    box-shadow: var(--shadow-3);
`;

const AvatarPosition = styled.div`
    position: absolute;
    z-index: 3;
    display: flex;
    padding: 3px;
    background: var(--color-panel-solid);
    border: 1px solid var(--gray-a5);
    border-radius: 999px;
    box-shadow: var(--shadow-2);
`;

const TopAvatar = styled(AvatarPosition)`
    top: 0;
    left: 50%;
    transform: translateX(-50%);
`;

const LeftAvatar = styled(AvatarPosition)`
    bottom: 2%;
    left: 8%;
`;

const RightAvatar = styled(AvatarPosition)`
    right: 8%;
    bottom: 2%;
`;

const Connection = styled.div`
    position: absolute;
    z-index: 1;
    height: 1px;
    transform-origin: left center;
    background: linear-gradient(90deg, var(--grass-a3), var(--grass-a8));
`;

const ConnectionTop = styled(Connection)`
    top: 26%;
    left: 50%;
    width: 38px;
    transform: rotate(90deg);
`;

const ConnectionLeft = styled(Connection)`
    bottom: 25%;
    left: 25%;
    width: 62px;
    transform: rotate(-25deg);
`;

const ConnectionRight = styled(Connection)`
    right: 25%;
    bottom: 25%;
    width: 62px;
    transform: rotate(205deg);
`;

const AuthHeadline = styled(Heading)`
    width: 100%;
    letter-spacing: -0.02em;
    line-height: 1.08;
`;

const AccentLine = styled.span`
    display: block;
    color: var(--grass-9);
`;

const ActionSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    width: 100%;
    max-width: 360px;
    margin-top: var(--space-5);

    @media ${MEDIA_QUERIES.belowSm} {
        margin-top: auto;
        padding-top: var(--space-5);
    }
`;

const GoogleAction = styled.div`
    width: 100%;

    & button {
        width: 100%;
        justify-content: center;
    }
`;

export {
    AccentLine,
    ActionSection,
    AuthBody,
    AuthHeadline,
    AuthLayout,
    ConnectionLeft,
    ConnectionRight,
    ConnectionTop,
    GoogleAction,
    HeroIllustration,
    LeftAvatar,
    ReceiptNode,
    RightAvatar,
    TopAvatar,
};
