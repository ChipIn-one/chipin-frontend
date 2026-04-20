import { Component } from 'react';
import { LucideHouse, LucideRotateCcw } from 'lucide-react';
import type { ErrorInfo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Badge, Box, Button, Flex, Heading, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { themeColor } from 'helpers/colors';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

interface GlobalErrorBoundaryProps {
    children: ReactNode;
}

interface GlobalErrorBoundaryState {
    error: Error | null;
}

interface ErrorFallbackProps {
    error: Error;
}

// background-image has no Radix prop equivalent
const ErrorBackground = styled(Box)`
    background-image: url('/error-background.png');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
`;

// absolute overlay requires inset + opacity not available via Radix props
const Overlay = styled(Box)`
    position: absolute;
    inset: 0;
    background-color: ${themeColor('gray1')};
    opacity: 0.5;
`;

// max-height, overflow, pre formatting not expressible via Radix props
const StackTraceBox = styled(Box)`
    max-height: 300px;
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

const ErrorFallback = ({ error }: ErrorFallbackProps) => {
    const { t } = useTranslation();
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const homeRoute = isLoggedIn ? ROUTES.DASHBOARD : ROUTES.HOME;
    const errorTitle = `${error.name}: ${error.message}`;

    return (
        <ErrorBackground minHeight="100vh" position="relative">
            <Overlay />

            <Flex
                position="relative"
                minHeight="100vh"
                align="center"
                justify="center"
                p={{ initial: '4', sm: '6' }}
            >
                <Flex
                    direction={{ initial: 'column', md: 'row' }}
                    gap="6"
                    align={{ initial: 'center', md: 'start' }}
                    maxWidth="900px"
                    width="100%"
                >
                    <Flex
                        direction="column"
                        gap="4"
                        align={{ initial: 'center', md: 'start' }}
                        flexGrow="1"
                        flexBasis="0"
                    >
                        <Badge size="3" color="red" variant="surface">
                            {t('errorBoundary.title')}
                        </Badge>

                        <Text size="3" color="gray">
                            {t('errorBoundary.description')}
                        </Text>

                        <Flex gap="3" wrap="wrap">
                            <Button
                                size="3"
                                color="grass"
                                onClick={() => window.location.assign(homeRoute)}
                            >
                                <LucideHouse size={16} />
                                {t('buttons.goHome')}
                            </Button>

                            <Button
                                size="3"
                                variant="soft"
                                onClick={() => window.location.reload()}
                            >
                                <LucideRotateCcw size={16} />
                                {t('buttons.reload')}
                            </Button>
                        </Flex>
                    </Flex>

                    <Flex direction="column" gap="3" flexGrow="1" flexBasis="0" width="100%">
                        <Heading size="3" color="red">
                            {errorTitle}
                        </Heading>

                        {error.stack && (
                            <StackTraceBox p="3">
                                <pre>{error.stack}</pre>
                            </StackTraceBox>
                        )}
                    </Flex>
                </Flex>
            </Flex>
        </ErrorBackground>
    );
};

class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
    state: GlobalErrorBoundaryState = {
        error: null,
    };

    static getDerivedStateFromError(error: Error): Partial<GlobalErrorBoundaryState> {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('GlobalErrorBoundary caught an error', error, info.componentStack);
    }

    render() {
        if (this.state.error) {
            return <ErrorFallback error={this.state.error} />;
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
