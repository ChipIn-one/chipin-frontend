// Isolate React SSR from the active Vite client build before Workbox scans dist.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const runPrerenderPublic = () =>
    execFileAsync(process.execPath, ['scripts/prerender-public.mjs'], {
        cwd: process.cwd(),
        maxBuffer: 8 * 1024 * 1024,
    }).then(({ stdout, stderr }) => {
        if (stdout) {
            process.stdout.write(stdout);
        }
        if (stderr) {
            process.stderr.write(stderr);
        }
    });

export { runPrerenderPublic };
