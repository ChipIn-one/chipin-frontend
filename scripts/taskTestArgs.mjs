const TEST_PATH_PATTERN = /(?:^|\/)(?:[^/]+\.)?(?:test|spec)\.[cm]?[jt]sx?$/u;

const isExplicitTestPath = (argument) => {
    return !argument.startsWith('-') && TEST_PATH_PATTERN.test(argument);
};

export const getTaskTestArgs = (args) => {
    if (!args.some(isExplicitTestPath)) {
        throw new Error(
            'test:task requires at least one explicit test path, for example: '
            + 'npm run test:task -- src/path/file.test.ts',
        );
    }

    return args;
};
