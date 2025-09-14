import { Link } from 'react-router-dom';

import { Button, Flex } from '@radix-ui/themes';

import { getSocialAuthUrl } from 'helpers/url';

const AuthButtons = () => {
    return (
        <Flex direction="column" gap="4">
            <Button size="4" variant="classic" color="blue" radius="full" asChild>
                {/* <FcGoogle style={{ marginRight: 8 }} /> */}
                <Link to={getSocialAuthUrl('google')}>Sign in with Google</Link>
            </Button>

            <Button size="4" variant="classic" color="gray" radius="full" disabled>
                {/* <FcGoogle style={{ marginRight: 8 }} /> */}
                {/* <Link to={getSocialAuthUrl('apple')}> Sign in with Apple</Link> */}
                Sign in with Apple
            </Button>
        </Flex>
    );
};

export default AuthButtons;
