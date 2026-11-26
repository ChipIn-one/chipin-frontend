const DESKTOP_SIDEBAR_WIDTH = '280px';
// 1136px is the Radix `--container-4` (Container size 4); there is no `--cp-*` container token.
const DESKTOP_SHELL_MAX_WIDTH = `calc(${DESKTOP_SIDEBAR_WIDTH} + 1136px + var(--cp-space-6))`;

export { DESKTOP_SHELL_MAX_WIDTH, DESKTOP_SIDEBAR_WIDTH };
