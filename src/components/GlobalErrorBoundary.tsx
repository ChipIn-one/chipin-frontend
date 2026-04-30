import { Component, useState } from 'react';
import {
    LucideAlertTriangle,
    LucideAsterisk,
    LucideCheck,
    LucideChevronDown,
    LucideChevronUp,
    LucideCopy,
    LucideHouse,
    LucideRotateCcw,
} from 'lucide-react';
import type { ErrorInfo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styled, { keyframes } from 'styled-components';

import { Avatar, Badge, Box, Button, Card, Container, Flex, Grid, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { APP_VERSION } from 'constants/version';
import { themeColor } from 'helpers/colors';
import { getIsDevEnv } from 'helpers/env';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import errorBackgroundImage from 'assets/error-background.jpg';

interface GlobalErrorBoundaryProps {
    children: ReactNode;
}

interface GlobalErrorBoundaryState {
    error: Error | null;
    timestamp: string | null;
}

interface ErrorFallbackProps {
    error: Error;
    timestamp: string;
}

// background-image has no Radix prop equivalent
const ErrorBackground = styled(Box)`
    background-image: url(${errorBackgroundImage});
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
`;

// opacity has no Radix prop equivalent; position and inset are passed via JSX props
const Overlay = styled(Box)`
    background-color: ${themeColor('gray1')};
    opacity: 0.4;
`;

// Keyframe for pulsing ring — no Radix prop equivalent
const pulseAnimation = keyframes`
    0% { transform: scale(0.9); opacity: 1; }
    100% { transform: scale(2.4); opacity: 0; }
`;

// Provides position: relative context for pulse rings — not expressible via Radix props
const IconWrapper = styled.span`
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
`;

// Circular pulsing border ring — requires keyframe animation and absolute positioning
// inset: -10px matches Avatar size="6" (40px) ring spacing
const PulseRing = styled.span<{ $delayed?: boolean }>`
    position: absolute;
    inset: -10px;
    border-radius: 50%;
    border: 2.5px solid ${themeColor('red9')};
    animation: ${pulseAnimation} 2.2s ease-out infinite;
    animation-delay: ${({ $delayed }) => ($delayed ? '1.1s' : '0s')};
    pointer-events: none;
`;

// Monospace font for error message — fontFamily has no Radix prop equivalent
const ErrorCode = styled.code`
    font-size: var(--font-size-2);
    font-family: var(--code-font-family);
    color: ${themeColor('gray12')};
    word-break: break-word;
    line-height: var(--line-height-3);
`;

// cursor: pointer required for non-button interactive toggle row
const StackToggle = styled.div`
    cursor: pointer;
    user-select: none;
`;

// word-break for long UA strings — no Radix prop equivalent
const UaSpan = styled.span`
    font-size: var(--font-size-1);
    color: ${themeColor('gray11')};
    word-break: break-word;
    line-height: var(--line-height-2);
`;

// white is not a Radix color token; always legible on this dark overlay background
const WhiteHeading = styled.p`
    margin: 0;
    font-size: var(--font-size-7);
    font-weight: var(--font-weight-bold);
    text-align: center;
    color: white;

    @media (max-width: 520px) {
        font-size: var(--font-size-6);
    }
`;

// overflow + nested pre styles not expressible via Radix props
const StackTraceBox = styled(Box)`
    overflow: auto;
    border-radius: var(--radius-2);
    background-color: ${themeColor('gray3')};

    pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: var(--font-size-1);
        font-family: var(--code-font-family);
        color: ${themeColor('gray11')};
    }
`;

const ErrorFallback = ({ error, timestamp }: ErrorFallbackProps) => {
    const { t } = useTranslation();
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const [isStackVisible, setIsStackVisible] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const homeRoute = isLoggedIn ? ROUTES.DASHBOARD : ROUTES.HOME;
    const isDevEnv = getIsDevEnv();
    const route = window.location.pathname;
    const userAgent = navigator.userAgent;
    const formattedTimestamp = new Date(timestamp).toLocaleString();
    const goHomeLabel = isLoggedIn ? t('buttons.goToDashboard') : t('buttons.goHome');

    const handleToggleStack = () => setIsStackVisible(prev => !prev);

    const handleCopyReport = async () => {
        const reportLines = [
            `Error: ${error.message}`,
            `Timestamp: ${timestamp}`,
            `Route: ${route}`,
            `Version: ${APP_VERSION}`,
            `User Agent: ${userAgent}`,
            '',
            error.stack ?? 'No stack trace available',
        ];

        try {
            await navigator.clipboard.writeText(reportLines.join('\n'));
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch {
            // clipboard access denied — silently ignore
        }
    };

    return (
        <ErrorBackground minHeight="100vh" position="relative">
            <Overlay position="absolute" inset="0" />

            <Flex
                position="relative"
                minHeight="100vh"
                align="center"
                justify="center"
                p={{ initial: '4', sm: '6' }}
                width="100%"
            >
                <Container size="2">
                    <Flex direction="column" align="center" gap="5">
                        {/* Pulsing icon */}
                        <IconWrapper>
                            <PulseRing />
                            <PulseRing $delayed />
                            <Avatar
                                size="5"
                                variant="solid"
                                color="red"
                                radius="large"
                                fallback={<LucideAlertTriangle size={26} />}
                            />
                        </IconWrapper>

                        {/* Environment badges */}
                        <Flex align="center" gap="4">
                            <Badge color="red" variant="solid" size="1">
                                {t('errorBoundary.runtimeError').toUpperCase()}
                            </Badge>

                            <Badge color={isDevEnv ? 'orange' : 'green'} variant="solid" size="1">
                                {isDevEnv ? 'DEVELOPMENT' : 'PRODUCTION'}
                            </Badge>
                        </Flex>

                        {/* Heading */}
                        <WhiteHeading>{t('errorBoundary.title')}</WhiteHeading>

                        {/* Subtitle card */}
                        <Box width="100%">
                            <Card variant="surface">
                                <Text size="2" align="center" as="p">
                                    {t('errorBoundary.subtitle')}
                                </Text>
                            </Card>
                        </Box>

                        {/* Error message card */}
                        <Box width="100%">
                            <Card variant="surface">
                                <Flex direction="column" gap="2">
                                    <Text size="1" color="red" weight="medium">
                                        {t('errorBoundary.errorMessage')}
                                    </Text>
                                    <Flex align="start" gap="2">
                                        <Text as="span" size="2" color="red">
                                            <LucideAsterisk size={14} />
                                        </Text>
                                        <ErrorCode>{error.message}</ErrorCode>
                                    </Flex>
                                </Flex>
                            </Card>
                        </Box>

                        {/* Info grid: timestamp / route / version */}
                        <Grid columns={{ initial: '1', sm: '3' }} gap="3" width="100%">
                            <Card variant="surface">
                                <Flex direction="column" gap="1">
                                    <Text size="1" color="gray" weight="medium">
                                        {t('errorBoundary.timestamp').toUpperCase()}
                                    </Text>
                                    <Text size="2" weight="bold">
                                        {formattedTimestamp}
                                    </Text>
                                </Flex>
                            </Card>
                            <Card variant="surface">
                                <Flex direction="column" gap="1">
                                    <Text size="1" color="gray" weight="medium">
                                        {t('errorBoundary.route').toUpperCase()}
                                    </Text>
                                    <Text size="2" weight="bold" truncate>
                                        {route}
                                    </Text>
                                </Flex>
                            </Card>
                            <Card variant="surface">
                                <Flex direction="column" gap="1">
                                    <Text size="1" color="gray" weight="medium">
                                        {t('errorBoundary.version').toUpperCase()}
                                    </Text>
                                    <Text size="2" weight="bold">
                                        {APP_VERSION}
                                    </Text>
                                </Flex>
                            </Card>
                        </Grid>

                        {/* User agent */}
                        <Box width="100%">
                            <Card variant="surface">
                                <Flex align="start" gap="2">
                                    <Box flexShrink="0">
                                        <Badge size="1" color="gray" variant="soft">
                                            {t('errorBoundary.userAgent').toUpperCase().slice(0, 2)}
                                        </Badge>
                                    </Box>
                                    <UaSpan>{userAgent}</UaSpan>
                                </Flex>
                            </Card>
                        </Box>

                        {/* Stack trace collapsible */}
                        {error.stack && (
                            <Box width="100%">
                                <StackToggle onClick={handleToggleStack}>
                                    <Card variant="surface">
                                        <Flex align="center" justify="between">
                                            <Text size="2" weight="medium">
                                                {t('errorBoundary.stackTrace')}
                                            </Text>
                                            {isStackVisible ? (
                                                <LucideChevronUp size={16} />
                                            ) : (
                                                <LucideChevronDown size={16} />
                                            )}
                                        </Flex>
                                    </Card>
                                </StackToggle>

                                {isStackVisible && (
                                    <StackTraceBox p="3" maxHeight="360px" mt="2">
                                        <pre>{error.stack}</pre>
                                    </StackTraceBox>
                                )}
                            </Box>
                        )}

                        {/* Action buttons */}
                        <Flex gap="3" wrap="wrap" justify="center" width="100%">
                            <Button
                                size="3"
                                color="grass"
                                onClick={() => window.location.assign(homeRoute)}
                            >
                                <LucideHouse size={16} />
                                {goHomeLabel}
                            </Button>
                            <Button
                                size="3"
                                variant="surface"
                                color="cyan"
                                onClick={() => window.location.reload()}
                            >
                                <LucideRotateCcw size={16} />
                                {t('buttons.reload')}
                            </Button>
                            <Button
                                size="3"
                                variant="surface"
                                color="gray"
                                onClick={handleCopyReport}
                            >
                                {isCopied ? <LucideCheck size={16} /> : <LucideCopy size={16} />}
                                {t('buttons.copyReport')}
                            </Button>
                        </Flex>
                    </Flex>
                </Container>
            </Flex>
        </ErrorBackground>
    );
};

class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
    state: GlobalErrorBoundaryState = {
        error: null,
        timestamp: null,
    };

    static getDerivedStateFromError(error: Error): Partial<GlobalErrorBoundaryState> {
        return { error, timestamp: new Date().toISOString() };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('GlobalErrorBoundary caught an error', error, info.componentStack);
    }

    render() {
        if (this.state.error) {
            return (
                <ErrorFallback
                    error={this.state.error}
                    timestamp={this.state.timestamp ?? new Date().toISOString()}
                />
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
