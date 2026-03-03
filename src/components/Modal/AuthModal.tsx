import AuthButtons from 'components/AuthButtons';

import BaseModal from './BaseModal';

interface Props {
    children: React.ReactNode;
}

const AuthModal = ({ children }: Props) => {
    return <BaseModal title="Sign in" triggerElement={children} content={<AuthButtons />} />;
};

export default AuthModal;
