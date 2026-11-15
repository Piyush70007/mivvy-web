import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url),target=new URL('public/audio/',root);
await fs.mkdir(target,{recursive:true});
await fs.copyFile(new URL('node_modules/@ozymandiasthegreat/vad/dist/libfvad.wasm',root),new URL('libfvad.wasm',target));
await fs.copyFile(new URL('node_modules/@ozymandiasthegreat/vad/LICENSE',root),new URL('LICENSE.libfvad.txt',target));
