import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

// Execute the actual packaging step against a previous-release fixture. Vite's
// public-directory copy is the boundary simulated by the tiny npm executable.
const workflow=fs.readFileSync('.github/workflows/build-rider-apk.yml','utf8');
const step=workflow.match(/      - name: Build packaged Rider web application\n        run: \|\n([\s\S]*?)(?=\n      - name:)/)?.[1];
assert.ok(step,'packaged Rider build step exists');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'rider-release-metadata-'));
try {
 fs.mkdirSync(path.join(temporary,'public/downloads'),{recursive:true});
 fs.mkdirSync(path.join(temporary,'bin'));
 fs.writeFileSync(path.join(temporary,'public/rider-release.json'),JSON.stringify({build:124,version:'1.0.124',versionCode:500124,apk:'/downloads/Britium-Express-Rider-Build124.apk'}));
 fs.writeFileSync(path.join(temporary,'public/downloads/old.apk'),'old APK');
 fs.writeFileSync(path.join(temporary,'bin/npm'),'#!/bin/sh\nmkdir -p dist/assets\ncp -r public/. dist/\nprintf "<html></html>" > dist/index.html\n',{mode:0o755});
 execFileSync('bash',['-c',step.split('\n').map(line=>line.replace(/^          /,'')).join('\n')],{cwd:temporary,env:{...process.env,PATH:path.join(temporary,'bin')+':'+process.env.PATH,GITHUB_RUN_NUMBER:'125'},stdio:'pipe'});
 const packaged=JSON.parse(fs.readFileSync(path.join(temporary,'dist/rider-release.json'),'utf8'));
 assert.equal(packaged.build,125,'APK must display its own build, never the previous release');
 assert.equal(packaged.version,'1.0.125');assert.equal(packaged.versionCode,500125);
 assert.equal(packaged.apk,'/downloads/Britium-Express-Rider-Build125.apk');
 assert.equal(fs.existsSync(path.join(temporary,'dist/downloads')),false,'previous APKs must remain outside the package');
 assert.deepEqual(packaged,JSON.parse(fs.readFileSync(path.join(temporary,'public/rider-release.json'),'utf8')));
 console.log('PASS packaged Rider release metadata matches the current Android build');
} finally {fs.rmSync(temporary,{recursive:true,force:true});}
