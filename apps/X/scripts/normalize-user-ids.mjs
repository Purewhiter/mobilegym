#!/usr/bin/env node
/**
 * One-time migration: normalize all X user IDs to u_${screenName}.
 *
 * Usage:
 *   node --max-old-space-size=4096 apps/X/scripts/normalize-user-ids.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../data');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── ID remapping table ────────────────────────────────────────────
// Old hand-written ID → new canonical ID (u_${screenName})
const REMAP = {
  'u_me':      'u_yihong0618',
  'u_openai':  'u_OpenAI',
  'u_elon':    'u_elonmusk',
  'u_maimai':  'u_MaimaiLee123',
  'u_wang':    'u_yuyy614893671',
  'u_xiong':   'u_xiongchun007',
  'u_skywind': 'u_skywind3000',
  'u_baye':    'u_waylybaye',
  'u_yihui':   'u_yihui_indie',
  'u_nate':    'u_nateleex',
  'u_doge':    'u_cb_doge',
  'u_william': 'u_williameijer',
  'u_ian':     'u_stillgray',
  'u_lidang':  'u_lidangzzz',
  'u_viking':  'u_vikingmute',
};

function remap(id) {
  return REMAP[id] ?? id;
}

// ─── 1. defaults.json ──────────────────────────────────────────────
console.log('=== defaults.json ===');

const defaultsPath = resolve(DATA_DIR, 'defaults.json');
const defaults = JSON.parse(readFileSync(defaultsPath, 'utf8'));

// 1a. xUsers — rename keys + id fields + add screenName where missing
const newXUsers = {};
for (const [oldKey, user] of Object.entries(defaults.xUsers)) {
  const newKey = remap(oldKey);
  const screenName = user.screenName || user.handle?.replace('@', '');
  newXUsers[newKey] = {
    ...user,
    id: newKey,
    screenName,
  };
  if (newKey !== oldKey) {
    console.log(`  xUsers: ${oldKey} -> ${newKey}`);
  }
}
defaults.xUsers = newXUsers;

// 1b. xPosts — remap authorId
for (const post of defaults.xPosts) {
  const newId = remap(post.authorId);
  if (newId !== post.authorId) {
    console.log(`  xPosts[${post.id}].authorId: ${post.authorId} -> ${newId}`);
    post.authorId = newId;
  }
}

// 1c. quotedPosts — remap authorId
for (const [key, qp] of Object.entries(defaults.quotedPosts || {})) {
  const newId = remap(qp.authorId);
  if (newId !== qp.authorId) {
    console.log(`  quotedPosts[${key}].authorId: ${qp.authorId} -> ${newId}`);
    qp.authorId = newId;
  }
}

// 1d. notifications — remap actorId
for (const n of defaults.notifications || []) {
  const newId = remap(n.actorId);
  if (newId !== n.actorId) {
    console.log(`  notifications[${n.id}].actorId: ${n.actorId} -> ${newId}`);
    n.actorId = newId;
  }
}

// 1e. conversations — remap participantId, senderId, receiverId
for (const c of defaults.conversations || []) {
  const newPart = remap(c.participantId);
  if (newPart !== c.participantId) {
    console.log(`  conversations[${c.id}].participantId: ${c.participantId} -> ${newPart}`);
    c.participantId = newPart;
  }
  for (const m of c.messages || []) {
    const newSender = remap(m.senderId);
    if (newSender !== m.senderId) {
      m.senderId = newSender;
    }
    const newReceiver = remap(m.receiverId);
    if (newReceiver !== m.receiverId) {
      m.receiverId = newReceiver;
    }
  }
}

// 1f. searchHistory — remap userId
for (const s of defaults.searchHistory || []) {
  if (s.userId) {
    const newId = remap(s.userId);
    if (newId !== s.userId) {
      console.log(`  searchHistory[${s.id}].userId: ${s.userId} -> ${newId}`);
      s.userId = newId;
    }
  }
}

// 1g. suggestedFollowingIds — remap entries
if (Array.isArray(defaults.suggestedFollowingIds)) {
  defaults.suggestedFollowingIds = defaults.suggestedFollowingIds.map(id => {
    const newId = remap(id);
    if (newId !== id) console.log(`  suggestedFollowingIds: ${id} -> ${newId}`);
    return newId;
  });
}

if (!DRY_RUN) {
  writeFileSync(defaultsPath, JSON.stringify(defaults, null, 2) + '\n', 'utf8');
  console.log('  -> written\n');
} else {
  console.log('  -> (dry run, not written)\n');
}

// ─── 2. users.json ─────────────────────────────────────────────────
console.log('=== users.json ===');

const usersPath = resolve(DATA_DIR, 'users.json');
const users = JSON.parse(readFileSync(usersPath, 'utf8'));
const beforeCount = Object.keys(users).length;

// 2a. Remove entries that duplicate xUsers (by canonical screenName)
const xUserCanonicals = new Set();
for (const user of Object.values(defaults.xUsers)) {
  const canonical = (user.screenName || '').toLowerCase();
  if (canonical) xUserCanonicals.add(canonical);
}

const toRemove = [];
for (const [id, user] of Object.entries(users)) {
  const canonical = (user.screenName || user.handle?.replace('@', '') || '').toLowerCase();
  if (xUserCanonicals.has(canonical)) {
    toRemove.push(id);
  }
}
for (const id of toRemove) {
  console.log(`  removing duplicate of xUsers: ${id}`);
  delete users[id];
}

// 2b. Remove internal case duplicates (keep the first one encountered)
const seenCanonicals = new Map();
const internalDupes = [];
for (const [id, user] of Object.entries(users)) {
  const canonical = (user.screenName || user.handle?.replace('@', '') || '').toLowerCase();
  if (!canonical) continue;
  if (seenCanonicals.has(canonical)) {
    internalDupes.push(id);
  } else {
    seenCanonicals.set(canonical, id);
  }
}
for (const id of internalDupes) {
  console.log(`  removing internal duplicate: ${id}`);
  delete users[id];
}

const afterCount = Object.keys(users).length;
console.log(`  ${beforeCount} -> ${afterCount} users (removed ${beforeCount - afterCount})`);

if (!DRY_RUN) {
  writeFileSync(usersPath, JSON.stringify(users, null, 2) + '\n', 'utf8');
  console.log('  -> written\n');
} else {
  console.log('  -> (dry run, not written)\n');
}

// ─── 3. replies.json (text replacement) ────────────────────────────
console.log('=== replies.json ===');

const repliesPath = resolve(DATA_DIR, 'replies.json');
let repliesText = readFileSync(repliesPath, 'utf8');

// Only replace IDs that actually appear in replies.json
const repliesReplacements = Object.entries(REMAP).filter(([oldId]) => {
  return repliesText.includes(`"${oldId}"`);
});

let totalReplacements = 0;
for (const [oldId, newId] of repliesReplacements) {
  const pattern = `"${oldId}"`;
  const replacement = `"${newId}"`;
  const count = repliesText.split(pattern).length - 1;
  if (count > 0) {
    console.log(`  "${oldId}" -> "${newId}": ${count} occurrences`);
    repliesText = repliesText.replaceAll(pattern, replacement);
    totalReplacements += count;
  }
}
console.log(`  total replacements: ${totalReplacements}`);

if (!DRY_RUN) {
  writeFileSync(repliesPath, repliesText, 'utf8');
  console.log('  -> written\n');
} else {
  console.log('  -> (dry run, not written)\n');
}

// Free memory
repliesText = null;

// ─── 4. posts.json (verify no changes needed) ─────────────────────
console.log('=== posts.json ===');

const postsPath = resolve(DATA_DIR, 'posts.json');
const postsText = readFileSync(postsPath, 'utf8');

let postsNeedChange = false;
for (const oldId of Object.keys(REMAP)) {
  if (postsText.includes(`"${oldId}"`)) {
    console.log(`  WARNING: "${oldId}" still appears in posts.json!`);
    postsNeedChange = true;
  }
}
if (!postsNeedChange) {
  console.log('  no changes needed (all authorIds already canonical)');
}

console.log('\n=== Done ===');
if (DRY_RUN) {
  console.log('(dry run — no files were modified)');
}
