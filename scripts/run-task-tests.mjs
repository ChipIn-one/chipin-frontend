import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { getTaskTestArgs } from './taskTestArgs.mjs';

const main = () => {
    let testArgs;

    try {
        testArgs = getTaskTestArgs(process.argv.slice(2));
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
    }

    const vitestCli = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [vitestCli, 'run', ...testArgs], {
        stdio: 'inherit',
    });

    if (result.error) {
        console.error(result.error);
        return 1;
    }

    return result.status ?? 1;
};

process.exitCode = main();
