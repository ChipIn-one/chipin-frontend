import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Box, Container, Flex, Link, Separator, Text } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';

import Logotype from 'assets/logo.svg?react';

const StyledLogotype = styled(Logotype)`
    width: 28px;
    height: 28px;
`;

const Footer = () => {
    const { t } = useTranslation();

    return (
        <Box py="6">
            <Separator orientation="horizontal" size="4" mb="6" />
            <Container size="4">
                {/* Desktop: three columns spread across — mobile: stacked centered */}
                <Flex
                    direction={{ initial: 'column', md: 'row' }}
                    align="center"
                    justify={{ initial: 'center', md: 'between' }}
                    gap="4"
                >
                    {/* Left — logo + name */}
                    <Flex align="center" gap="2">
                        <StyledLogotype />
                        <Text size="3" weight="bold">
                            {PROJECT_NAME}
                        </Text>
                    </Flex>

                    {/* Center — copyright */}
                    <Text size="2" color="gray" align="center">
                        {t('footer.copyright', {
                            name: PROJECT_NAME,
                            year: new Date().getFullYear(),
                        })}
                    </Text>

                    {/* Right — links */}
                    <Flex gap="5">
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
