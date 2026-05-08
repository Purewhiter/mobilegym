#!/usr/bin/env node
/**
 * Tests for lint_store_getters.mjs
 *
 * Usage: node scripts/lint_store_getters.test.mjs
 */
import { findActionsInterfaces, findGetterSubscriptions, QUERY_PREFIXES, SAFE_NAMES } from '../scripts/lint_store_getters.mjs';

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`);
  }
}

function assertEq(actual, expected, name) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     expected: ${JSON.stringify(expected)}`);
    console.log(`     actual:   ${JSON.stringify(actual)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Pass 1: findActionsInterfaces
// ═══════════════════════════════════════════════════════════════════════

console.log('\n── Pass 1: findActionsInterfaces ──\n');

// --- Basic detection ---
console.log('[1] Basic query getter detection');
{
  const src = `
interface FooActions {
  isLiked: (postId: string) => boolean;
  getLikedPosts: () => string[];
  setName: (name: string) => void;
  toggleLike: (postId: string) => void;
}`;
  const { issues, queryMethods } = findActionsInterfaces(src, 'test.ts');
  assertEq([...queryMethods].sort(), ['getLikedPosts', 'isLiked'], 'detects isLiked and getLikedPosts');
  assert(issues.length === 2, `finds 2 issues (got ${issues.length})`);
  assert(issues.every(i => i.iface === 'FooActions'), 'all issues reference FooActions');
}

// --- void return type is ignored ---
console.log('\n[2] Void return type skipped');
{
  const src = `
interface Actions {
  isReady: () => void;
  getItem: (id: string) => void;
}`;
  const { issues } = findActionsInterfaces(src, 'test.ts');
  assertEq(issues.length, 0, 'no issues for void-returning query methods');
}

// --- SAFE_NAMES are skipped ---
console.log('\n[3] SAFE_NAMES exemption');
{
  const src = `
interface PlayerActions {
  isPlaying: () => boolean;
  isLoading: () => boolean;
  isPaused: () => boolean;
}`;
  const { issues } = findActionsInterfaces(src, 'test.ts');
  assertEq(issues.length, 0, 'all SAFE_NAMES are skipped');
}

// --- Non-query prefixes are skipped ---
console.log('\n[4] Non-query method names ignored');
{
  const src = `
interface Actions {
  toggle: (id: string) => boolean;
  setActive: (v: boolean) => void;
  reset: () => string;
  fetchData: () => Promise<void>;
}`;
  const { issues } = findActionsInterfaces(src, 'test.ts');
  assertEq(issues.length, 0, 'toggle/set/reset/fetch are not query prefixes');
}

// --- [BUG FIX] interface with extends clause ---
console.log('\n[5] Interface with extends clause (bug fix)');
{
  const src = `
interface SpotifyActions extends BaseActions {
  isLiked: (trackId: string) => boolean;
  getTrackById: (id: string) => Track;
}`;
  const { issues, queryMethods } = findActionsInterfaces(src, 'test.ts');
  assertEq([...queryMethods].sort(), ['getTrackById', 'isLiked'], 'detects getters in extended interface');
  assert(issues.length === 2, `finds 2 issues in extended interface (got ${issues.length})`);
}

// --- [BUG FIX] multi-line method signature ---
console.log('\n[6] Multi-line method signature (bug fix)');
{
  const src = `
interface PostActions {
  isBookmarked: (
    postId: string,
    userId: string
  ) => boolean;
  getPostById: (
    id: string
  ) => Post;
  setTitle: (title: string) => void;
}`;
  const { issues, queryMethods } = findActionsInterfaces(src, 'test.ts');
  assertEq([...queryMethods].sort(), ['getPostById', 'isBookmarked'], 'detects multi-line signatures');
  assert(issues.length === 2, `finds 2 issues for multi-line signatures (got ${issues.length})`);
}

// --- check / has prefixes ---
console.log('\n[7] check* and has* prefixes');
{
  const src = `
interface AuthActions {
  checkPermission: (name: string) => boolean;
  hasAccess: (role: string) => boolean;
}`;
  const { issues, queryMethods } = findActionsInterfaces(src, 'test.ts');
  assertEq([...queryMethods].sort(), ['checkPermission', 'hasAccess'], 'detects check* and has*');
}

// --- prefix alone without uppercase follower is not a query ---
console.log('\n[8] Bare prefix without uppercase follower');
{
  const src = `
interface Actions {
  island: () => string;
  getting: () => number;
  hash: () => string;
  checkout: () => boolean;
}`;
  const { issues } = findActionsInterfaces(src, 'test.ts');
  assertEq(issues.length, 0, 'island/getting/hash/checkout are not flagged');
}

// --- Multiple interfaces in one file ---
console.log('\n[9] Multiple interfaces in one file');
{
  const src = `
interface FooActions {
  isReady: () => boolean;
}

interface BarActions {
  getFoo: () => Foo;
}

interface NotActions {
  isGood: () => boolean;
}`;
  const { issues } = findActionsInterfaces(src, 'test.ts');
  // isReady is not in SAFE_NAMES but starts with "is" + uppercase => flagged
  // NotActions doesn't have "Actions" in the right pattern... wait it does: *Actions*
  // Actually the regex is \w*Actions\w* so "NotActions" matches
  assert(issues.length === 3, `finds issues from all *Actions* interfaces (got ${issues.length})`);
  const ifaces = issues.map(i => i.iface).sort();
  assertEq(ifaces, ['BarActions', 'FooActions', 'NotActions'], 'issues from all three interfaces');
}

// --- interface with implements (rare in TS but valid syntax with extends) ---
console.log('\n[10] Interface extending multiple types');
{
  const src = `
interface ComplexActions extends Base, Extra {
  isValid: (id: string) => boolean;
}`;
  const { issues } = findActionsInterfaces(src, 'test.ts');
  assert(issues.length === 1, `detects getter in interface with multiple extends (got ${issues.length})`);
}

// --- Empty interface ---
console.log('\n[11] Empty interface');
{
  const src = `interface EmptyActions {}`;
  const { issues } = findActionsInterfaces(src, 'test.ts');
  assertEq(issues.length, 0, 'no issues for empty interface');
}

// --- Generic method signatures ---
console.log('\n[23] Generic method signatures');
{
  const src = `
interface ContactsActions {
  getPreference: <T extends PhoneSettingsValue>(key: string, fallback: T) => T;
  updateSettings: (patch: Record<string, PhoneSettingsValue>) => void;
}`;
  const { issues, queryMethods } = findActionsInterfaces(src, 'test.ts');
  assert(queryMethods.has('getPreference'), 'detects generic method getPreference');
  assertEq(issues.length, 1, `finds 1 issue for generic method (got ${issues.length})`);
  assertEq(issues[0]?.returnType, 'T', 'captures generic return type');
}

// --- Generic method with multi-line params ---
console.log('\n[24] Generic method with multi-line params');
{
  const src = `
interface Actions {
  getItemByKey: <K extends string>(
    key: K,
    defaultValue: Item
  ) => Item;
}`;
  const { issues, queryMethods } = findActionsInterfaces(src, 'test.ts');
  assert(queryMethods.has('getItemByKey'), 'detects generic + multi-line');
}

// ═══════════════════════════════════════════════════════════════════════
// Pass 2: findGetterSubscriptions
// ═══════════════════════════════════════════════════════════════════════

console.log('\n── Pass 2: findGetterSubscriptions ──\n');

// --- Basic detection ---
console.log('[12] Basic subscription detection');
{
  const src = `const liked = usePostStore(s => s.isLiked);`;
  const getters = new Set(['isLiked']);
  const issues = findGetterSubscriptions(src, 'test.tsx', getters);
  assert(issues.length === 1, `detects basic subscription (got ${issues.length})`);
  assertEq(issues[0]?.store, 'usePostStore', 'captures store name');
  assertEq(issues[0]?.method, 'isLiked', 'captures getter name');
}

// --- [BUG FIX] Arbitrary parameter name ---
console.log('\n[13] Arbitrary arrow parameter name (bug fix)');
{
  const getters = new Set(['isLiked']);
  const cases = [
    ['useAppStore(store => store.isLiked)', 'store'],
    ['useAppStore(x => x.isLiked)', 'x'],
    ['useAppStore(_ => _.isLiked)', '_'],
    ['useAppStore(foo => foo.isLiked)', 'foo'],
  ];
  for (const [src, param] of cases) {
    const issues = findGetterSubscriptions(src, 'test.tsx', getters);
    assert(issues.length === 1, `detects with param name "${param}" (got ${issues.length})`);
  }
}

// --- Mismatched parameter names should NOT match ---
console.log('\n[14] Mismatched parameter names');
{
  const src = `useAppStore(s => state.isLiked)`;
  const getters = new Set(['isLiked']);
  const issues = findGetterSubscriptions(src, 'test.tsx', getters);
  assertEq(issues.length, 0, 's => state.xxx is not a match (param mismatch)');
}

// --- Non-getter method names are not flagged ---
console.log('\n[15] Non-getter method names ignored');
{
  const src = `
const a = useAppStore(s => s.toggleLike);
const b = useAppStore(s => s.setName);
const c = useAppStore(s => s.posts);
`;
  const getters = new Set(['isLiked', 'getPost']);
  const issues = findGetterSubscriptions(src, 'test.tsx', getters);
  assertEq(issues.length, 0, 'non-getter subscriptions not flagged');
}

// --- Empty getters set returns no issues ---
console.log('\n[16] Empty known getters set');
{
  const src = `const x = useAppStore(s => s.isLiked);`;
  const issues = findGetterSubscriptions(src, 'test.tsx', new Set());
  assertEq(issues.length, 0, 'no issues when known getters set is empty');
}

// --- Multiple subscriptions in one file ---
console.log('\n[17] Multiple subscriptions');
{
  const src = `
const a = useAppStore(s => s.isLiked);
const b = useAppStore(state => state.getPost);
const c = useAppStore(s => s.checkValid);
`;
  const getters = new Set(['isLiked', 'getPost', 'checkValid']);
  const issues = findGetterSubscriptions(src, 'test.tsx', getters);
  assertEq(issues.length, 3, `detects all 3 subscriptions (got ${issues.length})`);
}

// --- Line number accuracy ---
console.log('\n[18] Line number accuracy');
{
  const src = `line1
line2
const x = usePostStore(s => s.isLiked);
line4`;
  const getters = new Set(['isLiked']);
  const issues = findGetterSubscriptions(src, 'test.tsx', getters);
  assertEq(issues[0]?.line, 3, 'reports correct line number');
}

// ═══════════════════════════════════════════════════════════════════════
// Cross-app isolation (conceptual — verifying the function signatures)
// ═══════════════════════════════════════════════════════════════════════

console.log('\n── Cross-app isolation ──\n');

console.log('[19] Per-app getter sets should NOT pollute each other');
{
  // Simulate: App A has isLiked, App B does NOT
  const appAGetters = new Set(['isLiked']);
  const appBGetters = new Set(); // App B has no query getters

  const appBConsumerSrc = `const x = useAppBDataStore(s => s.isLiked);`;

  // With per-app isolation, App B's consumers should NOT be checked against App A's getters
  const issuesB = findGetterSubscriptions(appBConsumerSrc, 'appB/Page.tsx', appBGetters);
  assertEq(issuesB.length, 0, 'App B consumers not flagged by App A getters (per-app isolation)');

  // But if you mistakenly use combined getters, it would be flagged (old bug)
  const combined = new Set([...appAGetters, ...appBGetters]);
  const issuesCombined = findGetterSubscriptions(appBConsumerSrc, 'appB/Page.tsx', combined);
  assert(issuesCombined.length === 1, 'combined set WOULD falsely flag (demonstrating old bug)');
}

// ═══════════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════════

console.log('\n── Edge cases ──\n');

console.log('[20] Nested braces inside interface');
{
  const src = `
interface Actions {
  getConfig: () => { nested: { deep: boolean } };
  isActive: () => boolean;
}`;
  const { issues, queryMethods } = findActionsInterfaces(src, 'test.ts');
  // getConfig's return type \S+ will match `{` — but that's fine, it won't be `void`
  // isActive should be detected
  assert(queryMethods.has('isActive'), 'isActive detected despite nested braces');
}

console.log('\n[21] Generic return types');
{
  const src = `
interface Actions {
  getItems: () => Promise<Item[]>;
  isValid: (id: string) => boolean;
}`;
  const { issues, queryMethods } = findActionsInterfaces(src, 'test.ts');
  assert(queryMethods.has('getItems'), 'getItems with generic return type detected');
  assert(queryMethods.has('isValid'), 'isValid still detected');
}

console.log('\n[22] Interface name with Actions as substring');
{
  const src = `
interface UserActionsExtra {
  isAdmin: () => boolean;
}`;
  const { issues } = findActionsInterfaces(src, 'test.ts');
  assert(issues.length === 1, 'matches UserActionsExtra');
  assertEq(issues[0]?.iface, 'UserActionsExtra', 'correct interface name');
}

// ═══════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`);
if (failed === 0) {
  console.log(`✅ All ${passed} tests passed.`);
} else {
  console.log(`❌ ${failed} failed, ${passed} passed, ${passed + failed} total.`);
}
process.exit(failed > 0 ? 1 : 0);
