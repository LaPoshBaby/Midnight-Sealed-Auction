/**
 * Copies the compiled Compact ZK artifacts into `public/zk` so the browser
 * can fetch them over HTTP:
 *
 *   public/zk/keys/<circuit>.prover
 *   public/zk/keys/<circuit>.verifier
 *   public/zk/zkir/<circuit>.bzkir
 *
 * This is the layout `FetchZkConfigProvider` expects. Runs automatically
 * before `npm run dev` and `npm run build`.
 */
import { cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(repoRoot, 'managed', 'auction');
const targetDir = join(repoRoot, 'public', 'zk');

async function hasArtifacts(directory) {
  try {
    const entries = await readdir(directory);
    return entries.length > 0;
  } catch {
    return false;
  }
}

if (!(await hasArtifacts(join(sourceDir, 'keys')))) {
  console.error(
    '[copy-zk-artifacts] No compiled artifacts in managed/auction/keys.\n' +
      'Run `npm run compile` (requires the Compact compiler) first.',
  );
  process.exit(1);
}

await mkdir(targetDir, { recursive: true });
for (const subDir of ['keys', 'zkir']) {
  await cp(join(sourceDir, subDir), join(targetDir, subDir), { recursive: true });
}

console.log(`[copy-zk-artifacts] ZK artifacts copied to ${targetDir}`);
