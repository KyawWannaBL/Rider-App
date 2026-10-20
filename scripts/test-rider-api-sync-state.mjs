import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

// Run the production TSX handlers with deterministic hooks and boundary adapters.
// No RPC, finance mutation, browser session, or duplicate implementation is used.
function component(file, dependencies, globals = {}) {
  const values = [];
  const effects = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = initial;
      return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      return values[index] ||= { current: initial };
    },
    useCallback: fn => fn,
    useMemo: fn => fn(),
    useEffect(fn) {
      const index = cursor++;
      if (!(index in values)) { values[index] = true; effects.push(fn); }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const deps = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': {},
    ...dependencies,
  };
  const context = { exports: {}, require(name) { assert.ok(name in deps, `Unexpected import: ${name}`); return deps[name]; }, ...globals };
  const code = ts.transpileModule(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, context);
  const render = () => { cursor = 0; return context.exports.default(); };
  return { render, async mount() { render(); for (const effect of effects.splice(0)) await effect(); await tick(); return render(); } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...Object.values(node.props || {}).flatMap(value => Array.isArray(value) ? value.flatMap(nodes) : nodes(value))];
}
function find(tree, predicate) { const node = nodes(tree).find(predicate); assert.ok(node, 'Expected rendered control'); return node; }
function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  return typeof node === 'object' ? textOf(node.props?.children) : String(node);
}
const A = { id: 'A', deliveryWayId: 'D-A', expectedCod: 100, collectedCod: 100 };
const B = { id: 'B', deliveryWayId: 'D-B', expectedCod: 200, collectedCod: 200 };
async function cod(submit = async () => ({ ok: true })) {
  const calls = [], readers = [];
  const page = component('src/pages/CodSettlementPageForVercel.tsx', {
    '@/components/rider/CODSettlementScreen': { CODSettlementScreen: 'Ledger' },
    '@/components/rider/RiderNotification': {},
    '@/hooks/useRiderRealtime': { useRiderRealtime() {} },
    '@/hooks/useAppState': { useAppState: () => ({ language: 'en' }) },
    '@/lib/riderOperations': {
      loadRiderSettlement: async () => ({ settlement: { lines: [A, B], summary: {} }, rawRows: [A, B].map(line => ({ delivery_way_id: line.deliveryWayId, eligible_to_handover: true })) }),
      submitCodHandover: async (...args) => { calls.push(args); return submit(...args); },
    },
  }, { FileReader: class {
    readAsDataURL() { readers.push(this); }
  } });
  await page.mount();
  return {
    ...page, calls, readers,
    select(line) { find(page.render(), n => n.type === 'Ledger').props.onSelectLine(line); },
    close() { find(page.render(), n => n.type === 'button' && textOf(n) === 'Close').props.onClick(); },
    photo() { find(page.render(), n => n.type === 'input' && n.props.type === 'file').props.onChange({ target: { files: [{ name: 'receipt-A.png', size: 100 }] } }); },
    finishPhoto(index = readers.length - 1, result = 'data:image/png;base64,RECEIPT_A') { readers[index].result = result; readers[index].onload(); },
    note(value) { find(page.render(), n => n.type === 'textarea').props.onChange({ target: { value } }); },
    submit() { return find(page.render(), n => n.type === 'button' && n.props.className?.includes('be-primary-button')).props.onClick; },
  };
}

test('COD receipt and note belong to their delivery way when selection changes', async () => {
  const p = await cod(); p.select(A); p.photo(); p.finishPhoto(); p.note('Only A'); p.select(B);
  p.submit()(); await tick();
  assert.equal(p.calls[0][0], 'D-B');
  assert.equal(p.calls[0][1].proofDataUrl, undefined);
  assert.equal(p.calls[0][1].note, undefined);
});
for (const close of [false, true]) test(`COD late file read cannot attach to another way after ${close ? 'close' : 'switch'}`, async () => {
  const p = await cod(); p.select(A); p.photo(); if (close) p.close(); p.select(B); p.finishPhoto();
  p.submit()(); await tick();
  assert.equal(p.calls[0][1].proofDataUrl, undefined);
});
test('COD consecutive clicks submit only once while request is pending', async () => {
  let resolve; const p = await cod(() => new Promise(done => { resolve = done; })); p.select(A);
  const submit = p.submit(); submit(); submit();
  assert.equal(p.calls.length, 1);
  resolve({ ok: true }); await tick();
});
test('COD backend rejection retains evidence for retry on the same way', async () => {
  const p = await cod(async () => { throw new Error('Rejected by server'); });
  p.select(A); p.photo(); p.finishPhoto(); p.note('Only A'); p.submit()(); await tick();
  assert.match(textOf(p.render()), /Rejected by server/);
  assert.equal(find(p.render(), n => n.type === 'textarea').props.value, 'Only A');
  p.submit()(); await tick(); assert.equal(p.calls.length, 2);
  assert.equal(p.calls[1][1].proofDataUrl, 'data:image/png;base64,RECEIPT_A');
});
for (const transport of [false, true]) test(`dashboard preserves Finance ${transport ? 'transport' : 'application'} failure`, async () => {
  const feedback = [];
  const p = component('src/pages/Dashboard.tsx', {
    'react-router-dom': {},
    '../hooks/useAppState': { useAppState: () => ({ language: 'en' }) },
    '../lib/riderFeedback': { riderFeedback: kind => feedback.push(kind) },
    '../components/shared/FinishAssignmentsButton': {},
    '../integrations/supabase/client': { supabase: { rpc: async name => name === 'be_finance_field_settlement_center_v1'
      ? transport ? { error: { message: 'Finance unavailable' } } : { error: null, data: { ok: false, error: 'Finance unavailable' } }
      : { error: null, data: { ok: true } } } },
  });
  await p.mount();
  assert.match(textOf(p.render()), /Finance unavailable/);
  assert.ok(!feedback.includes('success'));
});

test('COD older read stays obsolete after another read completes and a third starts', async () => {
  const p = await cod(); p.select(A); p.photo(); p.photo(); p.finishPhoto(1, 'data:SECOND');
  p.photo(); p.finishPhoto(0, 'data:STALE');
  // The third selected file is still pending, so no submission can use an older result.
  p.submit()(); await tick(); assert.equal(p.calls.length, 0);
  p.finishPhoto(2, 'data:THIRD'); p.submit()(); await tick();
  assert.equal(p.calls[0][1].proofDataUrl, 'data:THIRD');
});
test('COD switching back restores only that way draft for retry', async () => {
  const p = await cod(); p.select(A); p.photo(); p.finishPhoto(); p.note('Only A');
  p.select(B); p.note('Only B'); p.select(A);
  assert.equal(find(p.render(), n => n.type === 'textarea').props.value, 'Only A');
  p.submit()(); await tick();
  assert.equal(p.calls[0][1].proofDataUrl, 'data:image/png;base64,RECEIPT_A');
  assert.equal(p.calls[0][1].note, 'Only A');
});

test('dashboard rejected network promise reports error and enables sync retry', async () => {
  const feedback = [];
  let rejectNetwork = false;
  const p = component('src/pages/Dashboard.tsx', {
    'react-router-dom': {},
    '../hooks/useAppState': { useAppState: () => ({ language: 'en' }) },
    '../lib/riderFeedback': { riderFeedback: kind => feedback.push(kind) },
    '../components/shared/FinishAssignmentsButton': {},
    '../integrations/supabase/client': { supabase: { rpc: async name => {
      if (rejectNetwork && name === 'be_finance_field_settlement_center_v1') throw new Error('Network disconnected');
      return { error: null, data: { ok: true } };
    } } },
  });
  await p.mount();
  assert.match(textOf(p.render()), /field settlement are synchronized/);
  assert.equal(feedback.filter(kind => kind === 'success').length, 1);
  rejectNetwork = true;
  const sync = () => find(p.render(), n => n.type === 'button' && n.props.onClick?.name === 'load');
  await assert.doesNotReject(() => sync().props.onClick());
  assert.equal(sync().props.disabled, false);
  assert.match(textOf(p.render()), /Network disconnected/);
  assert.ok(feedback.includes('error'));
  assert.equal(feedback.filter(kind => kind === 'success').length, 1);
  rejectNetwork = false;
  await sync().props.onClick();
  assert.equal(sync().props.disabled, false);
  assert.match(textOf(p.render()), /field settlement are synchronized/);
  assert.equal(feedback.filter(kind => kind === 'success').length, 2);
});
