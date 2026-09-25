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

const IllustrationPanel = styled.div`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 390px;
    box-sizing: border-box;
    padding: var(--space-3);
    overflow: hidden;
    background:
        radial-gradient(circle at 50% 18%, var(--grass-a5), transparent 58%),
        var(--color-panel-solid);
    border: 1px solid var(--grass-a6);
    border-radius: var(--radius-5);
    box-shadow:
        inset 0 1px 0 var(--gray-a3),
        var(--shadow-3);

    @media ${MEDIA_QUERIES.belowSm} {
        max-width: 360px;
        padding: var(--space-2);
    }
`;

const HeroImage = styled.img`
    display: block;
    width: auto;
    max-width: 100%;
    height: auto;
    max-height: 280px;
    object-fit: contain;

    @media ${MEDIA_QUERIES.belowSm} {
        max-height: clamp(160px, 28dvh, 250px);
    }
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
    GoogleAction,
    HeroImage,
    IllustrationPanel,
};
