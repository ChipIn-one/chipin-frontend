import { useCheckSignIn } from 'hooks/useCheckSignIn';

/** The session check of the public branch; mounted only after hydration (browser only). */
const PublicSession = () => {
    useCheckSignIn();
    return null;
};

export { PublicSession };
