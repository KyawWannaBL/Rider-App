import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const authSource = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');
const helperBody = authSource.slice(authSource.indexOf('function isUnapprovedError'), authSource.indexOf('async function retry'));
const providerBody = authSource.slice(authSource.indexOf('  const [session'), authSource.indexOf('  useEffect(() => {'));
const eventBody = authSource.slice(authSource.indexOf('    const handleAuthEvent ='), authSource.indexOf('\n    void (async () =>', authSource.indexOf('    const handleAuthEvent =')));
const initialProfile = { canonical: { worker_code: 'R-A' } };
const sessionA = { user: { id: 'auth-A', email: 'a@example.com' } };
function harness() {
  const states = [sessionA, sessionA.user, initialProfile, 'approved', false, null];
  let index = 0;
  let rpcResult = { data: initialProfile };
  const timers = [];
  const context = {
    useState: () => { const i = index++; return [states[i], v => { states[i] = typeof v === 'function' ? v(states[i]) : v; }]; },
    useRef: v => ({ current: v }), useCallback: fn => fn,
    supabase: { rpc: async () => rpcResult }, enterpriseProfileOverlay: async data => data,
    withTimeout: promise => promise, retry: fn => fn(), isUnapprovedError: e => e?.code === '42501', normalizeNetworkMessage: e => e.message,
    window: { setTimeout: fn => timers.push(fn) }, console: { error: () => {} },
  };
  const exposed = vm.runInNewContext(ts.transpileModule(helperBody + '\n' + providerBody + '\n' + eventBody + '\n({handleAuthEvent, hydrateProfile, initialize: () => { if (typeof activeUserIdRef !== "undefined") activeUserIdRef.current = "auth-A"; if (typeof approvedUserIdRef !== "undefined") approvedUserIdRef.current = "auth-A"; }})', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  exposed.initialize();
  return { ...exposed, states, timers, result: v => { rpcResult = v; } };
}
const same = harness();
same.handleAuthEvent('SIGNED_IN', sessionA);
assert.equal(same.states[4], false, 'same-user foreground auth must keep the workspace mounted');
await same.timers.shift()();
await new Promise(resolve => setImmediate(resolve));
assert.equal(same.states[3], 'approved');

const switched = harness();
switched.handleAuthEvent('SIGNED_IN', { user: { id: 'auth-B' } });
assert.equal(switched.states[2], null, 'switching account clears previous operational profile synchronously');
assert.equal(switched.states[4], true);

const signedOut = harness();
signedOut.handleAuthEvent('SIGNED_IN', sessionA);
signedOut.handleAuthEvent('SIGNED_OUT', null);
for (const timer of signedOut.timers) timer();
await new Promise(resolve => setImmediate(resolve));
assert.equal(signedOut.states[2], null, 'queued foreground hydration must not resurrect a signed-out account');

const revoked = harness();
revoked.result({ error: { code: '42501' } });
revoked.handleAuthEvent('SIGNED_IN', sessionA);
revoked.timers.shift()();
await new Promise(resolve => setImmediate(resolve));
assert.equal(revoked.states[2], null);
assert.equal(revoked.states[3], 'unapproved');

for (const message of ['TypeError: Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', 'Enterprise profile timed out after 8000ms']) {
  const offline = harness();
  offline.result({ error: { message } });
  offline.handleAuthEvent('SIGNED_IN', sessionA);
  offline.timers.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(offline.states[2], initialProfile, 'background connection failure preserves the approved operational profile');
  assert.equal(offline.states[3], 'approved', 'background connection failure preserves the workspace guard');
  assert.equal(offline.states[4], false);
  assert.match(offline.states[5], /Unable to connect/, 'background failure remains observable through authError');
}

const initialOffline = harness();
initialOffline.result({ error: { message: 'Failed to fetch' } });
await initialOffline.hydrateProfile(sessionA, 'bootstrap');
assert.equal(initialOffline.states[2], null, 'initial login connection failure must remain blocked');
assert.equal(initialOffline.states[3], 'error');

for (const error of [
  { code: 'PGRST301', message: 'JWT expired' },
  { status: 401, message: 'Failed to fetch' },
  { code: '42501', message: 'Failed to fetch' },
  { code: 'XX000', message: 'Operation timed out in application logic' },
  { message: 'Unknown profile error' },
]) {
  const denied = harness();
  denied.result({ error });
  denied.handleAuthEvent('SIGNED_IN', sessionA);
  denied.timers.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(denied.states[2], null, 'explicit authentication, permission or application failure cannot preserve approval');
  assert.notEqual(denied.states[3], 'approved');
}
const applicationFailure = harness();
applicationFailure.result({ data: { ok: false, error: 'Account is inactive' } });
applicationFailure.handleAuthEvent('SIGNED_IN', sessionA);
applicationFailure.timers.shift()();
await new Promise(resolve => setImmediate(resolve));
assert.equal(applicationFailure.states[2], null);
assert.equal(applicationFailure.states[3], 'error');

const stale = harness();
let resolveEarlier;
stale.result(new Promise(resolve => { resolveEarlier = resolve; }));
stale.handleAuthEvent('SIGNED_IN', sessionA);
stale.timers.shift()();
await new Promise(resolve => setImmediate(resolve));
stale.handleAuthEvent('SIGNED_IN', { user: { id: 'auth-B' } });
resolveEarlier({ data: initialProfile });
await new Promise(resolve => setImmediate(resolve));
assert.equal(stale.states[2], null, 'late account A response must not repopulate account B profile');
assert.equal(stale.states[4], true, 'late account A response must not dismiss account B loading');

const profileSource = fs.readFileSync('src/pages/Profile.tsx', 'utf8');
const resetBody = profileSource.slice(profileSource.indexOf('  async function sendPasswordReset()'), profileSource.indexOf('\n  const identity ='));
let sent;
const reset = vm.runInNewContext(ts.transpileModule(resetBody+'\nsendPasswordReset', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
  user: sessionA.user, snapshot: { identity: { email: 'stale@example.com' } }, value: (...items) => items.find(Boolean),
  setMessage: () => {}, setLoading: () => {}, window: { location: { origin: 'https://rider.example.com' } },
  supabase: { auth: { getUser: async () => ({ data: { user: sessionA.user } }), resetPasswordForEmail: async (...args) => { sent = args; return {}; } } },
});
await reset();
assert.equal(sent[0], sessionA.user.email, 'recovery targets the authenticated login email');
assert.equal(sent[1].redirectTo, 'https://www.britiumexpress.com/reset-password');

const overlaySource = fs.readFileSync('src/lib/enterpriseProfileOverlay.ts', 'utf8').replace(/^import[^\n]+\n/, '').replace('export async function', 'async function');
function overlayHarness(auth, rpc) {
return vm.runInNewContext(ts.transpileModule(overlaySource+'\nenterpriseProfileOverlay', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
  supabase: { auth: { getUser: auth }, rpc },
  window: { setTimeout: fn => setTimeout(fn, 5), clearTimeout }, setTimeout: fn => setTimeout(fn, 5), clearTimeout,
});
}
const overlay = overlayHarness(async () => ({ data: { user: sessionA.user } }), () => new Promise(() => {}));
assert.equal(await Promise.race([overlay(initialProfile), new Promise(resolve => setTimeout(() => resolve('hung'), 100))]), initialProfile, 'optional overlay timeout preserves operational snapshot');
const stalledUser = overlayHarness(() => new Promise(() => {}), () => { throw Error('must not call identity RPC without a verified user'); });
assert.equal(await Promise.race([stalledUser(initialProfile), new Promise(resolve => setTimeout(() => resolve('hung'), 100))]), initialProfile);
const wrongIdentity = overlayHarness(async () => ({ data: { user: sessionA.user } }), async () => ({ data: { ok: true, auth_user_id: 'auth-B', full_name: 'Wrong person' } }));
assert.equal(await wrongIdentity(initialProfile), initialProfile, 'mismatched UUID never changes operational snapshot');
const rejectedOverlay = overlayHarness(async () => ({ data: { user: sessionA.user } }), () => Promise.reject(Error('offline')));
assert.equal(await rejectedOverlay(initialProfile), initialProfile, 'optional overlay network rejection preserves operational profile');
console.log('Rider auth/profile behavioral regressions PASS');
