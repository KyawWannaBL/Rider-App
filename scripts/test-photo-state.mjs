import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
// CI still includes Node 20. Compile the small pure state modules before node:test.
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'britium-photo-tests-'));
try {
  const names=['pickupPhotoState','deliveryPhotoState','proofUploadState','pickupPhotoIdentity'];
  for(const name of names){
    const source=await fs.readFile(`src/lib/${name}.ts`,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
    await fs.writeFile(path.join(dir,`${name}.mjs`),outputText);
  }
  const tests=[];
  for(const file of (await fs.readdir('tests')).filter(f=>f.endsWith('.test.mjs'))){
    let source=await fs.readFile(`tests/${file}`,'utf8');
    for(const name of names) source=source.replaceAll(`../src/lib/${name}.ts`,pathToFileURL(path.join(dir,`${name}.mjs`)).href);
    const target=path.join(dir,file);await fs.writeFile(target,source);tests.push(target);
  }
  const result=spawnSync(process.execPath,['--test',...tests],{stdio:'inherit'});
  process.exitCode=result.status ?? 1;
} finally { await fs.rm(dir,{recursive:true,force:true}); }
