import { spawn } from 'node:child_process';
import { platform } from 'node:os';

const port = process.env.PORT || '4173';
const viteBin = platform() === 'win32' ? 'node_modules\\.bin\\vite.cmd' : 'node_modules/.bin/vite';

const child = spawn(viteBin, ['preview', '--host', '0.0.0.0', '--port', port], {
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
