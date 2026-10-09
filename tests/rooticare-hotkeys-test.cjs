const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../scripts/rooticare/RootiCare 標註快捷鍵.user.js'), 'utf8');

async function run(displayed, typeIdx, target, pathname = '/rooti-care/dashboard/af', switchPath = null) {
    const listeners = {};
    const block = { tabIndex: 0, querySelector: () => label, querySelectorAll: () => [label] };
    const label = {
        textContent: displayed, tagName: 'text',
        classList: { contains: c => c === 'annoText' },
        closest: selector => selector === '.annoText' ? label : block,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 20, height: 20 }),
        getAttribute: name => name === 'typeIdx' ? String(typeIdx) : null,
        setAttribute: (name, value) => { if (name === 'typeIdx') typeIdx = Number(value); },
        dispatchEvent(event) {
            for (const fn of listeners[event.type] || []) fn({ ...event, target: label });
            // RootiCare's native click handler advances typeIdx, independently of text.
            if (event.type === 'click') {
                typeIdx = (typeIdx + 1) % 4;
                label.textContent = ['N', 'S', 'V', ''][typeIdx];
            }
        }
    };
    const document = {
        head: { appendChild() {} }, body: { appendChild() {} },
        activeElement: { tagName: 'BODY' },
        createElement: () => ({ style: {}, contains: () => false }),
        elementsFromPoint: () => [label], querySelector: () => null,
        addEventListener: (name, fn) => (listeners[name] ||= []).push(fn)
    };
    const location = { pathname };
    vm.runInNewContext(source, {
        document, window: { location, addEventListener() {} },
        MouseEvent: class { constructor(type, opts) { Object.assign(this, opts, { type }); } },
        setTimeout, clearTimeout
    });
    if (switchPath) location.pathname = switchPath;
    if (target === 'Alt') {
        const prevented = [];
        for (const type of ['keydown', 'keyup']) {
            for (const fn of listeners[type] || []) await fn({ key: 'Alt', altKey: type === 'keydown',
                preventDefault() { prevented.push(type); }, stopImmediatePropagation() {} });
        }
        return prevented;
    }
    if (target === 'click') label.dispatchEvent({ type: 'click' });
    else await listeners.keydown[0]({ key: target, preventDefault() {}, stopImmediatePropagation() {} });
    return label.textContent;
}

(async () => {
    // Exercise the request boundary as well as the pure filter calculation.
    // Simulate a server that rejects expanded lookback requests with a non-Error HTTP object.
    const rangeSource = source.slice(source.indexOf('    function getRangeUpdates('), source.indexOf('    function cancelRange('));
    const requests = [];
    const saved = [];
    const af = { record: {}, ecgAnno: { modifiedData: saved } };
    const context = { af, record: 'same', modifiedData: saved, rate: 250, index: 25000,
        startTime: 100, viewStart: 25000, scope: {}, parent: { af, $apply: fn => fn() } };
    const manager = { Af: {
        async getFilteredECGDataByIndexRange(...args) {
            requests.push(args);
            if (args[3] !== 25000) throw { status: 500 };
            return { anno: { 25000: 'V', 25250: 'S' }, sampleRate: 250 };
        },
        async getAdjacentFilteredECGLabel(...args) {
            assert.ok([25000, 24750].includes(args[3]));
            assert.equal(args[4], 1);
            return { plain: () => ({ [args[3] - 250]: 'N' }) };
        }
    } };
    const applyRange = vm.runInNewContext(`${rangeSource}\napplyIndexRange`, {
        isDisabledPage: () => false,
        rangeMode: null, document: { body: {} }, window: { angular: { element: () => ({ injector: () => ({ get: () => manager }) }) } }
    });
    const rangeFilters = { enabled: true, sources: ['V', 'S'], min: null, max: 60 };
    let rangeCount;
    try { rangeCount = await applyRange(context, { ...context, index: 25250 }, 'N', rangeFilters); }
    catch (error) { throw new Error(`BPM request flow failed (HTTP ${error.status || '?'})`); }
    assert.equal(rangeCount, 2);
    assert.deepEqual(saved.map(item => item[1]), [25000, 25250]);
    assert.equal(requests.length, 1);
    saved.length = 0;
    assert.equal(await applyRange(context, { ...context, index: 25250 }, 'N', {
        ...rangeFilters, enabled: false, variability: { enabled: true, min: 0, max: 0 }
    }), 2); // Both qualify at 0%, including the S preceded by V.
    assert.deepEqual(saved.map(item => item[1]), [25000, 25250]);
    console.log('PASS: BPM request flow keeps selected bounds and reads the preceding beat separately');
    const updateSource = source.slice(source.indexOf('    function getRangeUpdates('), source.indexOf('    async function applyIndexRange('));
    const getUpdates = vm.runInNewContext(`${updateSource}\ngetRangeUpdates`);
    const data = { anno: { 0: 'N', 250: 'A', 375: 'V', 625: 'N', 1125: 'S' } };
    const first = { rate: 250, startTime: 100, viewStart: 0 };
    function filtered(filters, pending = [], start = 250, end = 1125) {
        const effective = new Map(Object.entries(data.anno).map(([i, t]) => [Number(i), t]));
        for (const item of pending) effective.set(item[1], item[2]);
        return Array.from(getUpdates(effective, pending, data, first, start, end, 'N', filters), item => Array.from(item));
    }
    const base = { enabled: false, sources: ['N', 'S', 'V'], min: null, max: 60 };
    assert.deepEqual(filtered(base).map(u => u[1]), [250, 375, 1125]);
    assert.deepEqual(filtered({ ...base, enabled: true }).map(u => u[1]), [250, 1125]);
    assert.deepEqual(filtered({ ...base, enabled: true, min: 120, max: null }).map(u => u[1]), [375]);
    assert.deepEqual(filtered({ ...base, enabled: true, min: 60, max: 120 }).map(u => u[1]), [250, 375]);
    assert.deepEqual(filtered({ ...base, enabled: true, min: 60, max: 60 }).map(u => u[1]), [250]);
    assert.deepEqual(filtered({ ...base, enabled: true, min: 61, max: 119 }), []);
    const readFiltersSource = source.slice(source.indexOf('    function readRangeFilters('), source.indexOf('    function showRangeHint('));
    const controls = {
        'bpm-min-enabled': { checked: true }, 'bpm-max-enabled': { checked: true },
        'bpm-min': { value: '60' }, 'bpm-max': { value: '100' }
        , 'variability-min-enabled': { checked: false }, 'variability-max-enabled': { checked: false },
        'variability-min': { value: '12' }, 'variability-max': { value: '12' }
    };
    const readFilters = vm.runInNewContext(`${readFiltersSource}\nreadRangeFilters`, {
        rangeHint: { querySelector: selector => controls[selector.match(/"([^"]+)"/)[1]],
            querySelectorAll: () => [{ dataset: { source: 'V' } }] }
    });
    assert.equal(readFilters().min, 60);
    assert.equal(readFilters().max, 100);
    controls['bpm-min'].value = '101';
    assert.throws(readFilters, /下限不可大於上限/);
    controls['bpm-min-enabled'].checked = false;
    assert.equal(readFilters().min, null);
    controls['bpm-max'].value = '';
    assert.throws(readFilters, /大於 0/);
    controls['bpm-max-enabled'].checked = false;
    assert.equal(readFilters().enabled, false);
    controls['variability-min-enabled'].checked = true;
    assert.equal(readFilters().variability.min, 0.12);
    controls['variability-max-enabled'].checked = true;
    controls['variability-min'].value = '13';
    assert.throws(readFilters, /變動率下限不可大於上限/);
    controls['variability-min'].value = '';
    assert.throws(readFilters, /有效的變動率/);
    const variabilityData = { anno: { 0: 'N', 1120: 'N', 2120: 'V' } };
    const variabilityMap = new Map(Object.entries(variabilityData.anno).map(([i, t]) => [Number(i), t]));
    const variabilityFilter = { ...base, sources: ['V'], variability: { enabled: true, min: 0.12, max: 0.12 } };
    const variabilityUpdates = filters => Array.from(getUpdates(variabilityMap, [], variabilityData, first, 2120, 2120, 'S', filters));
    assert.equal(variabilityUpdates(variabilityFilter).length, 1); // Exactly 12%, inclusive on both sides.
    assert.equal(variabilityUpdates({ ...variabilityFilter, variability: { enabled: true, min: 0.121, max: null } }).length, 0);
    assert.equal(variabilityUpdates({ ...variabilityFilter, enabled: true, min: 16, max: null }).length, 0); // BPM 15: AND.
    variabilityMap.set(1120, 'S');
    assert.equal(variabilityUpdates(variabilityFilter).length, 1); // Predecessor labels do not restrict variability.
    variabilityMap.set(0, 'V');
    assert.equal(variabilityUpdates(variabilityFilter).length, 1);
    variabilityMap.set(1120, 'N');
    variabilityMap.delete(0);
    assert.equal(variabilityUpdates(variabilityFilter).length, 0); // Missing second predecessor.
    assert.deepEqual(filtered({ ...base, sources: ['S'] }).map(u => u[1]), [250, 1125]);
    assert.deepEqual(filtered({ ...base, enabled: true, sources: ['V'] }), []);
    const pending = [[101, 250, 'V', 'A', 1], [102, 375, 'X', 'V', 1]];
    const result = filtered({ ...base, enabled: true, sources: ['V'] }, pending);
    assert.equal(result[0][3], 'A'); // Keep original label when replacing an unsaved edit.
    assert.deepEqual(result.map(u => u[1]), [250]);
    assert.deepEqual(filtered({ ...base, enabled: true }, [], 0, 0), []);
    assert.deepEqual(filtered({ ...base, sources: ['V'] }, [], 250, 250), []);
    console.log('PASS: range BPM boundaries, source labels, pending edits, and bounded writes');
    let checks = 0;
    for (const displayed of ['N', 'S', 'V']) {
        // Ctrl edits update rendered text while native typeIdx can retain any prior state.
        for (const oldIndex of [0, 1, 2, 3]) {
            const next = { N: 'S', S: 'V', V: '' }[displayed];
            assert.equal(await run(displayed, oldIndex, 'click'), next, `${displayed}, stale ${oldIndex}: native click`);
            checks++;
            for (const [key, expected] of [['1', 'V'], ['2', 'S'], ['3', 'N'], ['4', '']]) {
                assert.equal(await run(displayed, oldIndex, key), expected, `${displayed}, stale ${oldIndex}: key ${key}`);
                checks++;
            }
        }
    }
    console.log(`PASS: ${checks} native-click and number-key checks with stale Ctrl-edit state`);
    for (const pathname of ['/rooti-care/morphology', '/rooti-care/morphology/']) {
        for (const key of ['1', '2', '3', '4']) {
            assert.equal(await run('S', 1, key, pathname), 'S');
            assert.equal(await run('S', 1, key, '/rooti-care/dashboard/af', pathname), 'S');
        }
        assert.equal(await run('V', 3, 'click', pathname), 'N'); // Native state is left untouched.
    }
    assert.equal(await run('S', 1, '1', '/rooti-care/morphology', '/rooti-care/dashboard/af'), 'V');
    console.log('PASS: Morphology shortcuts disabled on direct load and SPA navigation; enabled again on dashboard');
    assert.deepEqual(await run('N', 0, 'Alt'), ['keydown', 'keyup']);
    assert.deepEqual(await run('N', 0, 'Alt', '/rooti-care/morphology'), ['keydown', 'keyup']);
    console.log('PASS: standalone Alt default prevented across RootiCare, including Morphology');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
