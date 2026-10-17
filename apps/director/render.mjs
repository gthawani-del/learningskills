import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm, lstat, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
const runFile = promisify(execFile);
async function run(bin, args) {
  try { return await runFile(bin, args, { timeout: 90000, maxBuffer: 4 * 1024 * 1024, windowsHide: true }); }
  catch { throw Object.assign(new Error(`${bin} failed; no export produced. Check local media compatibility.`), { status: 422 }); }
}
async function probe(path) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm,avi,mpegts,ogg,mpeg', '-show_format', '-show_streams', '-of', 'json', path]);
  return JSON.parse(stdout);
}
function reject(message) { throw Object.assign(new Error(message), { status: 422 }); }
const near = (a, b) => Number.isFinite(a) && Math.abs(a - b) <= 0.1;
export async function renderFilm({ project, assets, assetDir }) {
  if (!project?.id || !Array.isArray(project.shots) || !project.shots.length) reject('Assign local video clips to the storyboard before export.');
  const shots = project.shots;
  const duration = shots.reduce((sum, shot) => sum + Number(shot.duration), 0);
  if (shots.length > 8 || !Number.isFinite(duration) || duration <= 0 || duration > 60 || shots.some(s => !Number.isFinite(s.duration) || s.duration <= 0)) reject('Local validation export supports at most 8 shots and 60 seconds. Hosted production rendering is separate.');
  if (!Number.isFinite(project.duration) || project.duration <= 0 || !near(duration, project.duration)) reject('Requested film duration must match the storyboard total within 0.1 seconds; export never silently shortens the brief.');
  if (!Array.isArray(assets) || typeof assetDir !== 'string') reject('Local asset storage unavailable.');
  const root = await realpath(assetDir);
  const clips = [];
  for (const shot of shots) {
    const asset = assets.find(a => a.id === shot.clipAssetId);
    if (!asset || (asset.projectId ?? asset.project_id) !== project.id || !/^video\//.test(asset.mime || '')) reject('Every shot requires a video asset from this project.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(asset.id)) reject('Invalid local asset identity.');
    const path = resolve(root, asset.id);
    let info;
    try {
      if ((await lstat(path)).isSymbolicLink() || !(await lstat(path)).isFile() || !(await realpath(path)).startsWith(root + sep)) reject('Unsafe local asset path.');
      info = await probe(path);
    } catch { reject('Assigned local video asset is missing or unreadable.'); }
    const video = info.streams.find(s => s.codec_type === 'video');
    const actual = Number(video?.duration ?? info.format?.duration);
    if (!video || !video.width || !video.height || !near(actual, shot.duration)) reject('Clip duration must match its shot within 0.1 seconds; export never silently trims, pads or freezes footage.');
    if (info.streams.some(s => s.codec_type === 'audio' && (!s.codec_name || !s.sample_rate))) reject('Unsupported source audio.');
    clips.push({ path, duration: actual, hasAudio: info.streams.some(s => s.codec_type === 'audio') });
  }
  const ratio = project.ratio ?? '16:9';
  if (!['16:9', '9:16'].includes(ratio)) reject('Local validation export supports 16:9 or 9:16.');
  const [width, height] = ratio === '9:16' ? [720, 1280] : [1280, 720];
  const temp = await mkdtemp(join(tmpdir(), 'director-render-'));
  try {
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const args = ['-v', 'error', '-nostdin', '-y', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm,avi,mpegts,ogg,mpeg', '-i', clip.path];
      if (!clip.hasAudio) args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
      args.push('-map', '0:v:0', '-map', clip.hasAudio ? '0:a:0' : '1:a:0', '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-threads', '1', '-c:a', 'aac', '-ar', '48000', '-ac', '2');
      // Bound only synthetic silence; source media is never shortened to a brief.
      if (!clip.hasAudio) args.push('-t', String(clip.duration));
      args.push('-movflags', '+faststart', join(temp, `clip-${i}.mp4`));
      await run('ffmpeg', args);
    }
    await writeFile(join(temp, 'sequence.txt'), clips.map((_, i) => `file 'clip-${i}.mp4'`).join('\n'));
    const output = join(temp, 'film.mp4');
    await run('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-f', 'concat', '-safe', '1', '-i', join(temp, 'sequence.txt'), '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy', '-movflags', '+faststart', output]);
    const result = await probe(output);
    if (!near(Number(result.format?.duration), duration) || !result.streams.some(s => s.codec_type === 'audio')) reject('Rendered duration or audio failed validation; no export delivered.');
    return await readFile(output);
  } finally { await rm(temp, { recursive: true, force: true }); }
}
