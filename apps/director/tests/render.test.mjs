import test from 'node:test';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { renderFilm } from '../render.mjs';
const run = promisify(execFile);
async function clip(path, frequency) {
  await run('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=24:d=1', '-f', 'lavfi', '-i', `sine=frequency=${frequency}:sample_rate=48000:duration=1`, '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-f', 'mp4', path]);
}
test('local export preserves two distinct source audio takes and exact sequence duration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'director-render-test-'));
  try {
    const ids = [randomUUID(), randomUUID()];
    await clip(join(dir, ids[0]), 440); await clip(join(dir, ids[1]), 880);
    const project = { id: 'project', duration: 2, ratio: '16:9', shots: ids.map(id => ({ clipAssetId: id, duration: 1 })) };
    const assets = ids.map(id => ({ id, projectId: 'project', mime: 'video/mp4' }));
    const result = await renderFilm({ project, assets, assetDir: dir });
    assert.ok(result.length > 1000);
    const path = join(dir, 'final.mp4'); await writeFile(path, result);
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path]);
    const info = JSON.parse(stdout);
    assert.ok(Math.abs(Number(info.format.duration) - 2) <= 0.1);
    assert.ok(info.streams.some(s => s.codec_type === 'audio' && s.sample_rate === '48000'));
    const { stdout: pcm } = await run('ffmpeg', ['-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', '48000', '-f', 's16le', 'pipe:1'], { encoding: 'buffer', maxBuffer: 1024 * 1024 });
    function crossings(start) {
      let count = 0;
      for (let i = Math.floor(start * 48000) + 1; i < Math.floor((start + 0.3) * 48000); i++) if (pcm.readInt16LE((i - 1) * 2) <= 0 && pcm.readInt16LE(i * 2) > 0) count++;
      return count;
    }
    const first = crossings(0.3); const second = crossings(1.3);
    assert.ok(first > 110 && first < 150, `first source tone retained: ${first}`);
    assert.ok(second > 240 && second < 285, `second source tone retained: ${second}`);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('export rejects missing, foreign and duration-incompatible clips', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'director-reject-test-'));
  try {
    const id = randomUUID(); await clip(join(dir, id), 440);
    const project = { id: 'project', duration: 1, shots: [{ clipAssetId: id, duration: 1 }] };
    await assert.rejects(renderFilm({ project, assets: [], assetDir: dir }), /requires a video/);
    await assert.rejects(renderFilm({ project, assets: [{ id, projectId: 'foreign', mime: 'video/mp4' }], assetDir: dir }), /requires a video/);
    project.duration = 2;
    await assert.rejects(renderFilm({ project, assets: [{ id, projectId: 'project', mime: 'video/mp4' }], assetDir: dir }), /Requested film duration/);
    project.shots[0].duration = 2;
    await assert.rejects(renderFilm({ project, assets: [{ id, projectId: 'project', mime: 'video/mp4' }], assetDir: dir }), /duration must match/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
