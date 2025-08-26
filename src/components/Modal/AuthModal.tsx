import { Link } from 'react-router-dom';

import { Button, Flex } from '@radix-ui/themes';

import { getSocialAuthUrl } from 'helpers/url';

import BaseModal from './Modal';

interface Props {
    triggerElement: React.ReactNode;
}

const AuthModal = ({ triggerElement }: Props) => {
    return (
        <BaseModal
            triggerElement={triggerElement}
            content={
                <Flex direction="column" gap="4">
                    <Button size="3" variant="soft" color="lime" asChild>
                        {/* <FcGoogle style={{ marginRight: 8 }} /> */}
                        <Link to={getSocialAuthUrl('google')}>Sign in with Google</Link>
                    </Button>

                    <Button size="3" variant="classic" asChild disabled>
                        {/* <FcGoogle style={{ marginRight: 8 }} /> */}
                        <Link to={getSocialAuthUrl('apple')}> Sign in with Apple</Link>
                    </Button>
                </Flex>
            }
        />
    );
};

export default AuthModal;
