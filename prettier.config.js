/** @type {import('prettier').Config} */
export default {
    printWidth: 100,
    tabWidth: 4,
    useTabs: false,
    semi: true,
    singleQuote: true,
    jsxSingleQuote: false,
    trailingComma: 'all',
    arrowParens: 'avoid',
    bracketSpacing: true,
    bracketSameLine: false,
    endOfLine: 'lf',
    overrides: [
        // JSON keeps 4 spaces (the repo's JSON files and .editorconfig use 4).
        { files: ['*.yml', '*.yaml'], options: { tabWidth: 2 } },
        // embeddedLanguageFormatting off: keep 4-space code samples in Markdown as written.
        {
            files: ['*.md'],
            options: { tabWidth: 2, proseWrap: 'preserve', embeddedLanguageFormatting: 'off' },
        },
    ],
};
