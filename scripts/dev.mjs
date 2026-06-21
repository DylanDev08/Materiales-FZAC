import { spawn } from 'node:child_process';

const commands = [
  { name: 'server', args: ['run', 'dev:server'] },
  { name: 'client', args: ['run', 'dev:client'] }
];

const children = commands.map(({ name, args }) => {
  const child = spawn('npm', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] finalizo con codigo ${code}`);
      process.exitCode = code;
    }
  });

  return child;
});

const stop = () => {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
};

process.on('SIGINT', () => {
  stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stop();
  process.exit(0);
});
