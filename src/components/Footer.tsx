import { LucideSend } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Avatar, Box, Container, Flex, Link, Separator, Text } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';

import Logotype from 'assets/logo.svg?react';

const StyledLogotype = styled(Logotype)`
    width: 28px;
    height: 28px;
`;

const MEDIA_LINKS = [
    {
        href: 'https://t.me/chipin_one',
        label: 'Telegram',
        Icon: LucideSend,
    },
] as const;

const Footer = () => {
    const { t } = useTranslation();

    return (
        <Box py={{ initial: '4', md: '6' }}>
            <Separator orientation="horizontal" size="4" mb={{ initial: '4', md: '6' }} />
            <Container size="4">
                {/* Desktop: three columns spread across — mobile: stacked centered */}
                <Flex
                    direction={{ initial: 'column', md: 'row' }}
                    align="center"
                    justify={{ initial: 'center', md: 'between' }}
                    gap={{ initial: '3', md: '4' }}
                >
                    {/* Left — logo + name */}
                    <Flex gap="2" direction="column">
                        <Flex align="center" gap="2">
                            <StyledLogotype />
                            <Text size="3" weight="bold" as="span">
                                {PROJECT_NAME}
                            </Text>
                        </Flex>
                        <Text size="1" color="gray" as="span">
                            {t('footer.copyright', {
                                year: new Date().getFullYear(),
                            })}
                        </Text>
                    </Flex>

                    <Box display={{ initial: 'block', md: 'none' }} width="100%">
                        <Separator orientation="horizontal" size="4" />
                    </Box>

                    <Flex
                        align="center"
                        justify="center"
                        wrap="wrap"
                        width={{ initial: '100%', md: 'auto' }}
                        gap={{ initial: '3', md: '4' }}
                    >
                        <Text size="2" color="gray" as="span">
                            {t('footer.mediaTitle')}
                        </Text>
                        <Box display={{ initial: 'none', md: 'block' }}>
                            <Separator orientation="vertical" size="2" />
                        </Box>
                        <Flex align="center" justify="center" gap="4" wrap="wrap">
                            {MEDIA_LINKS.map(({ href, label, Icon }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    color="gray"
                                    size="2"
                                    underline="hover"
                                >
                                    <Flex align="center" gap="2">
                                        <Avatar
                                            fallback={<Icon size={16} />}
                                            size="2"
                                            radius="full"
                                            color="blue"
                                            variant="soft"
                                        />
                                        {label}
                                    </Flex>
                                </Link>
                            ))}
                        </Flex>
                    </Flex>

                    <Box display={{ initial: 'block', md: 'none' }} width="100%">
                        <Separator orientation="horizontal" size="4" />
                    </Box>

                    {/* Right — links */}
                    <Flex justify="center" gap={{ initial: '3', md: '5' }} wrap="wrap">
                        <Link href="#" color="gray" size="2" underline="hover">
                            {t('footer.privacy')}
                        </Link>
                        <Link href="#" color="gray" size="2" underline="hover">
                            {t('footer.terms')}
                        </Link>
                        <Link href="#" color="gray" size="2" underline="hover">
                            {t('footer.contact')}
                        </Link>
                    </Flex>
                </Flex>
            </Container>
        </Box>
    );
};

export default Footer;
