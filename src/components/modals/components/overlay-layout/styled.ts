import styled, { createGlobalStyle } from 'styled-components';

import { ScrollArea, Separator } from '@radix-ui/themes';

import { MEDIA_QUERIES } from 'constants/breakpoints';

const ModalOverlayGlobalStyles = createGlobalStyle`
    @media ${MEDIA_QUERIES.belowSm} {
        :has(> .modal-overlay-content) {
            padding: 0;
            margin: 0;
            flex-grow: unset;
        }

        .modal-overlay-content {
            position: fixed !important;
            display: flex;
            flex-direction: column;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            transform: none !important;
            width: 100vw !important;
            max-width: 100vw !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden;
        }
    }
`;

const HeaderContainer = styled.div`
    flex-shrink: 0;
    background: inherit;

    @media ${MEDIA_QUERIES.belowSm} {
        position: sticky;
        top: 0;
        padding: var(--space-4) var(--space-4) 0;
    }
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding-bottom: var(--space-4);
`;

const Body = styled(ScrollArea)`
    min-width: 0;
    min-height: 0;
    flex: 1;
    height: auto;

    & [data-radix-scroll-area-viewport] {
        overscroll-behavior: contain;
    }

    & [data-radix-scroll-area-viewport] > div {
        width: 100%;
        min-width: 0 !important;
    }
`;

const BodyContent = styled.div`
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding-top: var(--space-6);

    @media ${MEDIA_QUERIES.belowSm} {
        padding: var(--space-4);
    }
`;

const FooterContainer = styled.div`
    flex-shrink: 0;
    margin-top: var(--space-4);
    background: inherit;

    @media ${MEDIA_QUERIES.belowSm} {
        position: sticky;
        bottom: 0;
        margin-top: 0;
        padding: 0 var(--space-4);
    }
`;

const Footer = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);

    @media ${MEDIA_QUERIES.belowSm} {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
        padding: var(--space-4) 0;
        padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));

        & > * {
            width: 100%;
            min-width: 0;
        }
    }
`;

const FooterSeparator = styled(Separator)`
    display: none;

    @media ${MEDIA_QUERIES.belowSm} {
        display: block;
    }
`;

export {
    Body,
    BodyContent,
    Footer,
    FooterContainer,
    FooterSeparator,
    Header,
    HeaderContainer,
    ModalOverlayGlobalStyles,
};
