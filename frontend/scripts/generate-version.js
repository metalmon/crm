// generate-version.js
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

function safeExec(cmd) {
  try {
    return execSync(cmd).toString().trim();
  } catch {
    return '';
  }
}

const commit = safeExec('git rev-parse --short HEAD');
const branch = safeExec('git rev-parse --abbrev-ref HEAD');
const commit_message = safeExec('git log -1 --pretty=%B');
const commit_date = safeExec('git log -1 --date=short --pretty=format:%cd');
const tag = safeExec('git describe --tags --abbrev=0');

const version = { commit, branch, commit_message, commit_date, tag };

const outPath = join(process.cwd(), 'public', 'version.json');
writeFileSync(outPath, JSON.stringify(version, null, 2));
console.log('Generated version.json:', version); 