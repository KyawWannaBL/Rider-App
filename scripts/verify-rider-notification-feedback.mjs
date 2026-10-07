import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function loadFeedback(options = {}) {
  const source = await readFile(new URL('../src/lib/riderFeedback.ts', import.meta.url), 'utf8');
  let code;
  try {
    const ts = (await import('typescript')).default;
    code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    const { stripTypeScriptTypes } = await import('node:module');
    code = stripTypeScriptTypes(source).replace(/export /g, '');
    code += '\nObject.assign(exports, { playRiderFeedback, installGlobalRiderNotificationFeedback });';
  }
  let now = 10000;
  let onMutation;
  let resolveResume;
  let starts = 0;
  let contexts = 0;
  const listeners = new Map();
  const nodes = [];
  class Element {
    constructor(text = '', role = 'status') { this.textContent = text; this.role = role; this.attrs = new Map(); this.children = []; this.className = ''; }
    getAttribute(name) { return name === 'role' ? this.role : this.attrs.get(name) || null; }
    hasAttribute(name) { return this.attrs.has(name); }
    setAttribute(name, value) { this.attrs.set(name, value); }
    matches() { return this.role === 'status' || this.role === 'alert'; }
    closest() { return this.matches() ? this : this.parentElement?.closest() || null; }
    querySelectorAll() { return this.children.filter(n => n.matches()); }
  }
  const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  const context = {
    state: options.suspended ? 'suspended' : 'running', currentTime: 0, destination: {},
    resume() {
      if (options.rejectResume) return Promise.reject(new Error('Audio blocked'));
      return new Promise(resolve => { resolveResume = () => { context.state = 'running'; resolve(); }; });
    },
    createGain() { return { gain: param, connect() {}, disconnect() {} }; },
    createOscillator() { return { frequency: param, connect() {}, disconnect() {}, start() { starts++; }, stop() {} }; },
  };
  const window = {
    AudioContext: class { constructor() { contexts++; return context; } },
    getComputedStyle(node) { return { display: node.hidden ? 'none' : 'block', visibility: 'visible', opacity: '1' }; },
    addEventListener(name, fn) { listeners.set(name, fn); },
    alert() {}, confirm() { return true; },
  };
  const document = { readyState: 'complete', body: {}, querySelectorAll() { return nodes; }, addEventListener() {} };
  const sandbox = { exports: {}, window, document, navigator: { vibrate() {} }, Element, HTMLElement: Element,
    Date: { now: () => now }, WeakMap, Map, Set, console,
    MutationObserver: class { constructor(fn) { onMutation = fn; } observe() {} },
  };
  vm.runInNewContext(code, sandbox);
  return { api: sandbox.exports, Element, context, window, nodes, listeners,
    mutate(mutation) { onMutation([mutation]); }, advance() { now += 2000; },
    resume() { resolveResume(); }, starts: () => starts, contexts: () => contexts };
}

const cases = [
  ['waits for suspended audio before scheduling a notification', async () => {
    const h = await loadFeedback({ suspended: true });
    h.api.playRiderFeedback('success');
    assert.equal(h.starts(), 0, 'must wait for audio resume');
    h.resume(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.starts(), 1);
    h.api.playRiderFeedback('warning');
    assert.equal(h.contexts(), 1, 'audio context is reused');
  }],
  ['sounds when an initially empty status receives text', async () => {
    const h = await loadFeedback(); const node = new h.Element(); h.nodes.push(node);
    h.api.installGlobalRiderNotificationFeedback(); node.textContent = 'Parcel saved';
    h.mutate({ type: 'childList', target: node, addedNodes: [{ parentElement: node }] });
    assert.equal(h.starts(), 1);
  }],
  ['sounds for changed text in a reused status without repeating unchanged text', async () => {
    const h = await loadFeedback(); const node = new h.Element('Saving parcel'); h.nodes.push(node);
    h.api.installGlobalRiderNotificationFeedback(); assert.equal(h.starts(), 1);
    h.advance(); node.textContent = 'Parcel saved';
    h.mutate({ type: 'characterData', target: { parentElement: node }, addedNodes: [] });
    assert.equal(h.starts(), 2);
    h.advance(); h.mutate({ type: 'childList', target: node, addedNodes: [] });
    assert.equal(h.starts(), 2, 'unchanged messages stay silent');
  }],
  ['sounds when a hidden status becomes visible', async () => {
    const h = await loadFeedback(); const node = new h.Element('Dispatch assigned'); node.hidden = true; h.nodes.push(node);
    h.api.installGlobalRiderNotificationFeedback(); assert.equal(h.starts(), 0);
    node.hidden = false; h.mutate({ type: 'attributes', target: node, addedNodes: [] });
    assert.equal(h.starts(), 1);
  }],
  ['blocked audio does not reject into delivery operations', async () => {
    const h = await loadFeedback({ suspended: true, rejectResume: true });
    await h.api.playRiderFeedback('error');
    assert.equal(h.starts(), 0);
  }],
  ['sounds for the first new unread notification and replacements at the same count', async () => {
    const source = await readFile(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8');
    const start = source.indexOf('  async function loadNotifications()');
    const end = source.indexOf('  async function markNotificationRead', start);
    assert.ok(start >= 0 && end > start, 'notification loader is present');
    const { stripTypeScriptTypes } = await import('node:module').catch(() => ({}));
    let code;
    try {
      const ts = (await import('typescript')).default;
      code = ts.transpileModule(source.slice(start, end)).outputText;
    } catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
      code = stripTypeScriptTypes(source.slice(start, end));
    }
    let rows = []; let sounds = 0;
    const sandbox = {
      exports: {}, console, Set,
      previousUnread: { current: 0 }, previousNotifications: { current: null },
      notificationSession: { current: 1 }, notificationRequest: { current: null },
      setLoadingNotifications() {}, setNotifications() {}, riderFeedback() { sounds++; },
      supabase: { rpc: async () => ({ data: { notifications: rows }, error: null }) },
    };
    vm.runInNewContext(code + '\nexports.load = loadNotifications;', sandbox);
    await sandbox.exports.load(); assert.equal(sounds, 0, 'initial snapshot is silent');
    rows = [{ id: 'a', is_read: false }]; await sandbox.exports.load();
    assert.equal(sounds, 1, 'zero to one unread must sound');
    await sandbox.exports.load(); assert.equal(sounds, 1, 'refresh must not replay existing notifications');
    rows = [{ id: 'a', is_read: true }, { id: 'b', is_read: false }]; await sandbox.exports.load();
    assert.equal(sounds, 2, 'a new notification must sound even if unread count is unchanged');
  }],
];
let failures = 0;
for (const [name, run] of cases) {
  try { await run(); console.log('PASS:', name); }
  catch (error) { failures++; console.error('FAIL:', name, error.message); }
}
if (failures) process.exitCode = 1;
