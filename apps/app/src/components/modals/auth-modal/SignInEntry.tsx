import type { ReactElement } from 'react';

import { AuthModal } from './AuthModal';

/** A sign-in CTA: its child opens the auth modal. */
const SignInEntry = ({ children }: { children: ReactElement }) => <AuthModal>{children}</AuthModal>;

export { SignInEntry };
