import fs from 'fs'; import path from 'path';
const src = 'contracts/out/MyHook.sol/MyHook.json';
const dst = 'apps/ui/src/abis/MyHook.json';
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log('ABI synced ->', dst);
