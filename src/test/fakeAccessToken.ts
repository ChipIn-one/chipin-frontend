/** An unsigned JWT with `sub` = the user id, as the backend issues (only `sub` is read). */
export const fakeAccessToken = (userId: string): string => {
    const encode = (value: object): string =>
        btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: userId })}.signature`;
};
