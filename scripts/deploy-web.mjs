#!/usr/bin/env node
// deploy-web — 公開 Web（Cloudflare Workers）を手元から配る（#2664）
//
// 使い方（どこから打ってもよい。web/ では `npm run deploy` が同じものを呼ぶ）:
//   node scripts/deploy-web.mjs                # 値の確認 → shared / web のビルド → web/dist の確認 → wrangler deploy
//   node scripts/deploy-web.mjs --install      # ビルドの前に shared / web で `npm ci` する（node_modules が古いとき）
//   node scripts/deploy-web.mjs --dry-run      # 配布だけ飛ばす（ビルドと web/dist の確認までは回す）
//   node scripts/deploy-web.mjs --verify-only  # web/dist の確認だけ（deploy-web.yml もこれを呼ぶ）
//   node scripts/deploy-web.mjs --verify-only --dist <dir>  # 別の dist を確認する（確認そのものの試験用）
//
// 2026-11-05 から GitHub Actions が支払いのロックで起動しなくなり、こうだいさんは billing を
// 払わない方針のため、配布を手元に移した。web/dist の確認はこのファイルだけに書き、
// deploy-web.yml からも呼ぶ — 2 か所に写すと片方だけ古くなる（CLAUDE.md §0 の数値の非複製原則）。
//
// 前提:
//   - Cloudflare の認証。初回だけ `npx wrangler@4 login`（ブラウザで許可）。API トークンは要らない。
//   - VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY。Vite がビルド時に文字列へ焼き込むため、
//     配布の前に要る。環境変数か、web/ の .env / .env.local / .env.production / .env.production.local
//     （.gitignore で除外済みの *.local に置く）のどれかに書く。service_role key は絶対に置かない
//     （RLS を素通りする合鍵で、ここに置くと公開バンドルに載る）。

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB = path.join(ROOT, "web");
const SHARED = path.join(ROOT, "shared");
const REQUIRED_ENV = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
// Vite が production のビルドで読む順。後ろほど優先だが、ここでは「どれかにあるか」だけを見る。
const ENV_FILES = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
];
const REQUIRED_DIST_FILES = [
  "index.html",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "sw.js",
];

const KNOWN_FLAGS = new Set([
  "--install",
  "--dry-run",
  "--verify-only",
  "--dist",
]);

function parseArgs(argv) {
  const opts = {
    install: false,
    dryRun: false,
    verifyOnly: false,
    dist: path.join(WEB, "dist"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!KNOWN_FLAGS.has(a)) fail(`知らない引数です: ${a}`, 2);
    if (a === "--install") opts.install = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--verify-only") opts.verifyOnly = true;
    else if (a === "--dist") {
      const v = argv[++i];
      if (!v) fail("--dist にはフォルダを渡します", 2);
      opts.dist = path.resolve(v);
    }
  }
  return opts;
}

// GitHub Actions の上では注釈として出し、手元ではそのまま出す。
function report(message) {
  console.error(
    process.env.GITHUB_ACTIONS ? `::error::${message}` : `ERROR ${message}`,
  );
}

function fail(message, code = 1) {
  report(message);
  process.exit(code);
}

function step(label) {
  console.log(`\n=== ${label}`);
}

// Windows の npm / npx は .cmd なので shell 経由でないと起動できない。shell に配列の引数を
// 渡すと Node 24 が DEP0190 を出すので、1 本の文字列にする（引数はこのファイルの固定値だけ）。
function run(command, args, cwd) {
  const r =
    process.platform === "win32"
      ? spawnSync([command, ...args].join(" "), {
          cwd,
          stdio: "inherit",
          shell: true,
        })
      : spawnSync(command, args, { cwd, stdio: "inherit" });
  if (r.error)
    fail(
      `${command} ${args.join(" ")} を起動できませんでした: ${r.error.message}`,
    );
  if (r.status !== 0)
    fail(
      `${command} ${args.join(" ")} が終了コード ${r.status} で止まりました（${path.relative(ROOT, cwd) || "."}）`,
    );
}

function envFileKeys(file) {
  if (!fs.existsSync(file)) return new Set();
  const keys = new Set();
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
    );
    if (!m) continue;
    const value = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    if (value !== "") keys.add(m[1]);
  }
  return keys;
}

// 値そのものは読み出さず、名前があるかだけを見る（ログに鍵を出さないため）。
function checkEnv() {
  const fromFiles = new Set(
    ENV_FILES.flatMap((f) => [...envFileKeys(path.join(WEB, f))]),
  );
  const missing = REQUIRED_ENV.filter(
    (k) => !process.env[k] && !fromFiles.has(k),
  );
  if (missing.length > 0) {
    fail(
      `${missing.join(" / ")} がありません。環境変数か web/.env.production.local に書いてから打ち直してください。` +
        "値が無いままビルドすると、Supabase に繋がらないページがそのまま公開されます。",
    );
  }
  console.log(`OK  ${REQUIRED_ENV.join(" / ")} が見つかりました`);
}

// 配る中身が欠けていたら止める。env の欠けなどでビルドが中途半端に通ると、
// 壊れたページが無言で公開されるため。
function verifyDist(dist) {
  const problems = [];
  if (!fs.existsSync(dist))
    return [`${dist} がありません。先にビルドしてください`];
  for (const f of REQUIRED_DIST_FILES) {
    if (!fs.existsSync(path.join(dist, f)))
      problems.push(`${f} が ${dist} にありません`);
  }
  const indexPath = path.join(dist, "index.html");
  if (
    fs.existsSync(indexPath) &&
    fs.readFileSync(indexPath, "utf8").includes("<title>web</title>")
  ) {
    problems.push("index.html の題が仮の <title>web</title> のままです");
  }
  // sw.js に載っていない画面は、オフラインで開けない（#2334）。
  const swPath = path.join(dist, "sw.js");
  const assets = path.join(dist, "assets");
  const chunks = fs.existsSync(assets)
    ? fs.readdirSync(assets).filter((n) => n.endsWith(".js"))
    : [];
  if (chunks.length === 0)
    problems.push(`${path.join(dist, "assets")} に .js がありません`);
  if (fs.existsSync(swPath)) {
    const sw = fs.readFileSync(swPath, "utf8");
    for (const chunk of chunks) {
      if (!sw.includes(`assets/${chunk}`))
        problems.push(`sw.js が assets/${chunk} を載せていません`);
    }
  }
  return problems;
}

function runVerify(dist) {
  const problems = verifyDist(dist);
  if (problems.length > 0) {
    problems.forEach(report);
    fail(
      `web/dist の確認で ${problems.length} 件の問題が見つかりました。配布しません`,
    );
  }
  console.log(`OK  ${path.relative(ROOT, dist) || dist} の中身が揃っています`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.verifyOnly) {
    step("web/dist の確認");
    runVerify(opts.dist);
    return;
  }

  step("Supabase の値の確認");
  checkEnv();

  if (opts.install) {
    step("shared — npm ci");
    run("npm", ["ci"], SHARED);
    step("web — npm ci");
    run("npm", ["ci"], WEB);
  }

  step("shared — build");
  run("npm", ["run", "build"], SHARED);
  step("web — build");
  run("npm", ["run", "build"], WEB);

  step("web/dist の確認");
  runVerify(opts.dist);

  if (opts.dryRun) {
    console.log("\n--dry-run のため配布はしませんでした");
    return;
  }

  // wrangler 4 系に固定する。3 系には静的アセットだけの Worker の概念が無く、
  // `main` の無い web/wrangler.jsonc を蹴る（#600 実測）。
  step("Cloudflare Workers へ配布");
  run("npx", ["--yes", "wrangler@4", "deploy"], WEB);
  console.log(
    "\n配布しました。https://life-editor.sunbreak-pro.workers.dev を開いて確かめてください",
  );
}

main();
