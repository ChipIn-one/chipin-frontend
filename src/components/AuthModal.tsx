import { Link } from 'react-router-dom';

import { Button, Dialog, Flex } from '@radix-ui/themes';

import { getSocialAuthUrl } from 'helpers/url';

const AuthModal = () => {
    return (
        <Dialog.Root>
            <Dialog.Trigger>
                <Button variant="outline" size="3">
                    Sign in
                </Button>
            </Dialog.Trigger>

            <Dialog.Content maxWidth="360px">
                <Flex direction="column" gap="4">
                    <Dialog.Title>Sign in</Dialog.Title>
                    <Dialog.Description size="2">Choose a provider to continue</Dialog.Description>

                    <Button size="3" variant="classic" asChild>
                        {/* <FcGoogle style={{ marginRight: 8 }} /> */}
                        <Link to={getSocialAuthUrl('google')}>Sign in with Google</Link>
                    </Button>

                    <Button size="3" variant="classic" asChild disabled>
                        {/* <FcGoogle style={{ marginRight: 8 }} /> */}
                        <Link to={getSocialAuthUrl('apple')}> Sign in with Apple</Link>
                    </Button>

                    {/* <Dialog.Close>
                        <Button variant="soft" color="gray">
                            Close
                        </Button>
                    </Dialog.Close> */}
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export default AuthModal;
