#!/usr/bin/env node
//
// ambient-loops.mjs — build and measure the five ambient loops served from
// the public Storage bucket `sounds` (#1793).
//
// The bucket holds the audio; the repo holds only this script and the
// manifest next to it (ambient-sources.json: where each recording came from,
// its licence, and which stretch of it becomes the loop). Rebuilding from the
// manifest gives the same audio that was uploaded (byte-identical only with
// the same ffmpeg / LAME build — the 2026-09-28 files came from ffmpeg 7.1).
//
// What a loop has to satisfy is written in shared/src/constants/sounds.ts:
// encoded once from lossless material, no silence at either end, the seam
// joined, at least 60 s long. `build` does that as follows:
//
//   1. decode `length + xfade` seconds from `start` to 48 kHz stereo float,
//      through the entry's ffmpeg `filter` if it has one (the fire takes a
//      limiter: its crackle peaks sit 40 dB over the bed, so step 3 would
//      otherwise leave the bed barely audible)
//   2. cross-fade the extra `xfade` seconds over the head (equal power, since
//      the two halves are uncorrelated noise), so the last sample runs
//      straight into the first one when the element wraps
//   3. scale to one RMS target so the five presets sit at the same level
//      (the gain is lowered instead if a peak would pass -1 dBFS)
//   4. encode once with LAME at CBR 320 kbps, keeping the LAME tag so
//      players that honour it drop the encoder's own priming and padding
//
// Usage:
//   node supabase/scripts/ambient-loops.mjs build   <srcDir> <outDir> [id...]
//   node supabase/scripts/ambient-loops.mjs measure <file.mp3|wav|flac>...
//
// <srcDir> holds each manifest entry's `file`, downloaded from its
// `download` URL. ffmpeg is not a dependency of the repo; the script runs
// the one on PATH, or the one named by FFMPEG.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FFMPEG = process.env.FFMPEG || "ffmpeg";
const RATE = 48000;
const CHANNELS = 2;
const TARGET_RMS_DB = -28;
const PEAK_CEILING_DB = -1;
const BITRATE = "320k";

const dbOf = (x) => 20 * Math.log10(Math.max(x, 1e-12));
const gainOf = (db) => 10 ** (db / 20);

function ffmpeg(args, { input } = {}) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", ...args], {
    input,
    maxBuffer: 1 << 30,
  });
  if (r.error) throw new Error(`cannot run ffmpeg (${FFMPEG}): ${r.error.message}`);
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr.toString()}`);
  return r.stdout;
}

/** Decode to interleaved 48 kHz stereo float. */
function decode(file, { start, duration, filter, rawMp3 = false } = {}) {
  const args = [];
  // rawMp3 keeps the encoder's priming and padding, which is what a player
  // that ignores the LAME tag plays back.
  if (rawMp3) args.push("-flags2", "+skip_manual");
  if (start !== undefined) args.push("-ss", String(start));
  if (duration !== undefined) args.push("-t", String(duration));
  args.push("-i", file);
  if (filter) args.push("-af", filter);
  args.push("-ac", String(CHANNELS), "-ar", String(RATE), "-f", "f32le", "-");
  const buf = ffmpeg(args);
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4).slice();
}

function rmsAndPeak(pcm) {
  let sum = 0;
  let peak = 0;
  for (const v of pcm) {
    sum += v * v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  return { rms: Math.sqrt(sum / pcm.length), peak };
}

function buildOne(entry, srcDir, outDir) {
  const { id, file, start, length, xfade, filter } = entry;
  const frames = Math.round(length * RATE);
  const fadeFrames = Math.round(xfade * RATE);
  const seg = decode(join(srcDir, file), { start, duration: length + xfade + 1, filter });
  if (seg.length < (frames + fadeFrames) * CHANNELS) {
    throw new Error(`${id}: ${file} is shorter than start + length + xfade`);
  }

  const out = seg.slice(0, frames * CHANNELS);
  for (let i = 0; i < fadeFrames; i++) {
    const t = (i + 0.5) / fadeFrames;
    const fadeIn = Math.sin((t * Math.PI) / 2);
    const fadeOut = Math.cos((t * Math.PI) / 2);
    for (let c = 0; c < CHANNELS; c++) {
      const head = seg[i * CHANNELS + c];
      const tail = seg[(frames + i) * CHANNELS + c];
      out[i * CHANNELS + c] = head * fadeIn + tail * fadeOut;
    }
  }

  const { rms, peak } = rmsAndPeak(out);
  let gainDb = TARGET_RMS_DB - dbOf(rms);
  if (dbOf(peak) + gainDb > PEAK_CEILING_DB) gainDb = PEAK_CEILING_DB - dbOf(peak);
  const g = gainOf(gainDb);
  for (let i = 0; i < out.length; i++) out[i] *= g;

  const tmp = mkdtempSync(join(tmpdir(), "ambient-"));
  try {
    const raw = join(tmp, `${id}.f32`);
    writeFileSync(raw, Buffer.from(out.buffer));
    const dest = join(outDir, `${id}.mp3`);
    ffmpeg([
      "-y",
      "-f", "f32le", "-ar", String(RATE), "-ac", String(CHANNELS), "-i", raw,
      "-c:a", "libmp3lame", "-b:a", BITRATE,
      "-write_xing", "1",
      "-map_metadata", "-1",
      dest,
    ]);
    console.log(`${id}: ${length}s from ${file} @ ${start}s, gain ${gainDb.toFixed(1)} dB -> ${dest}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- measure

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

/**
 * Median power spectrum of the mid channel, in dB per bin. The median over
 * time, not the mean: a few loud frames (a crackle, a gust) otherwise fill
 * in the bands a low-bitrate encode has cut away.
 */
function spectrum(pcm, n = 4096) {
  const frames = pcm.length / CHANNELS;
  const blocks = Math.floor(frames / n);
  const bins = n / 2;
  const power = new Float32Array(blocks * bins);
  const win = Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  for (let b = 0; b < blocks; b++) {
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const f = b * n + i;
      re[i] = ((pcm[f * 2] + pcm[f * 2 + 1]) / 2) * win[i];
    }
    fft(re, im);
    for (let k = 0; k < bins; k++) power[b * bins + k] = re[k] * re[k] + im[k] * im[k];
  }
  const column = new Float32Array(blocks);
  return Array.from({ length: bins }, (_, k) => {
    for (let b = 0; b < blocks; b++) column[b] = power[b * bins + k];
    column.sort();
    return 10 * Math.log10(column[blocks >> 1] + 1e-30);
  });
}

/** Level of a band relative to the 1–4 kHz band, in dB. */
function bandRel(spec, lo, hi, n = 4096) {
  const bin = (f) => Math.round((f * n) / RATE);
  const mean = (a, b) => {
    let s = 0;
    for (let k = bin(a); k < bin(b); k++) s += 10 ** (spec[k] / 10);
    return 10 * Math.log10(s / (bin(b) - bin(a)));
  };
  return mean(lo, hi) - mean(1000, 4000);
}

/** Largest drop between neighbouring 500 Hz bands above 12 kHz. */
function brickwall(spec) {
  let best = { drop: 0, at: 0 };
  for (let f = 12000; f + 1000 <= 22000; f += 250) {
    const drop = bandRel(spec, f, f + 500) - bandRel(spec, f + 500, f + 1000);
    if (drop > best.drop) best = { drop, at: f + 500 };
  }
  return best;
}

/** Silence at either end: runs of 1 ms windows below -60 dBFS. */
function edgeSilenceMs(pcm) {
  const win = RATE / 1000;
  const frames = pcm.length / CHANNELS;
  const quiet = (w) => {
    let s = 0;
    for (let i = w * win; i < (w + 1) * win; i++) s += pcm[i * 2] ** 2 + pcm[i * 2 + 1] ** 2;
    return dbOf(Math.sqrt(s / (win * 2))) < -60;
  };
  const total = Math.floor(frames / win);
  let head = 0;
  while (head < total && quiet(head)) head++;
  let tail = 0;
  while (tail < total && quiet(total - 1 - tail)) tail++;
  return { head, tail };
}

/**
 * Step at the wrap point, against the typical step between neighbours.
 * Near 1 means the wrap sounds like any other sample; it reads 0 when both
 * ends are silent, so read it together with the silence column.
 */
function seamRatio(pcm) {
  const frames = pcm.length / CHANNELS;
  let sum = 0;
  for (let i = 1; i < frames; i++) sum += Math.abs(pcm[i * 2] - pcm[(i - 1) * 2]);
  const typical = sum / (frames - 1);
  return Math.abs(pcm[0] - pcm[(frames - 1) * 2]) / typical;
}

function measure(file) {
  const pcm = decode(file);
  const raw = file.endsWith(".mp3") ? decode(file, { rawMp3: true }) : pcm;
  const { rms, peak } = rmsAndPeak(pcm);
  const spec = spectrum(pcm);
  const wall = brickwall(spec);
  const trimmed = edgeSilenceMs(pcm);
  const untrimmed = edgeSilenceMs(raw);
  return {
    file: basename(file),
    seconds: +(pcm.length / CHANNELS / RATE).toFixed(1),
    rmsDb: +dbOf(rms).toFixed(1),
    peakDb: +dbOf(peak).toFixed(1),
    band16to18: +bandRel(spec, 16000, 18000).toFixed(1),
    band18to20: +bandRel(spec, 18000, 20000).toFixed(1),
    wallDb: +wall.drop.toFixed(1),
    wallHz: wall.at,
    silenceMs: `${trimmed.head}/${trimmed.tail}`,
    silenceMsNoTag: `${untrimmed.head}/${untrimmed.tail}`,
    seamRatio: +seamRatio(pcm).toFixed(2),
  };
}

// ---------------------------------------------------------------- main

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "build") {
  const [srcDir, outDir, ...ids] = rest;
  if (!srcDir || !outDir) throw new Error("usage: build <srcDir> <outDir> [id...]");
  const here = dirname(fileURLToPath(import.meta.url));
  const manifest = JSON.parse(readFileSync(join(here, "ambient-sources.json"), "utf8"));
  for (const entry of manifest.sounds) {
    if (ids.length === 0 || ids.includes(entry.id)) buildOne(entry, srcDir, outDir);
  }
} else if (cmd === "measure") {
  console.table(rest.map(measure));
} else {
  console.error("usage: ambient-loops.mjs build <srcDir> <outDir> [id...] | measure <file>...");
  process.exit(2);
}
