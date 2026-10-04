// Run the complete userscript against RootiCare-shaped DOM fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../scripts/rooticare/RootiCare ECG 變動率自動標註器 測試版.user.js'), 'utf8');

function style() {
    const values = new Map(), priorities = new Map();
    return {
        setProperty(k, v, p = '') { values.set(k, v); priorities.set(k, p); },
        getPropertyValue(k) { return values.get(k) || ''; },
        getPropertyPriority(k) { return priorities.get(k) || ''; },
        removeProperty(k) { values.delete(k); priorities.delete(k); }
    };
}
function run(specs) {
    const timers = new Map(), events = {}, overlays = [];
    let id = 0, observer;
    const groups = specs.map(({ values, labels, noData = false }) => ({
        labels: labels.map((text, i) => ({
            textContent: text, ...(!noData && { __data__: { index: i * 100, type: 'N' } })
        })),
        elements: values.map((value, i) => {
            const span = { style: style(), textContent: value === null ? '' : '100' };
            const element = {
                ...(!noData && { __data__: i * 100 }),
                childNodes: [{ nodeType: 3, textContent: value === null ? '' : String(value) }],
                style: style(), span, querySelector: () => span, querySelectorAll: () => [span]
            };
            element.style.setProperty('fill', 'black');
            return element;
        }),
        querySelectorAll(s) { return s === 'text.annoText' ? this.labels : this.elements; },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
    }));
    const document = {
        activeElement: { tagName: 'BODY' }, addEventListener() {},
        querySelectorAll: s => s === '.annoGroup' ? groups : [...overlays],
        body: { appendChild(item) { overlays.push(item); } },
        createElement() { return { style: {}, remove() { overlays.splice(overlays.indexOf(this), 1); } }; }
    };
    vm.runInNewContext(source, {
        document, window: { scrollX: 0, scrollY: 0, addEventListener(n, fn) { events[n] = fn; } },
        console: { groupCollapsed() {}, table() {}, groupEnd() {} },
        setTimeout(fn) { timers.set(++id, fn); return id; },
        clearTimeout(i) { timers.delete(i); },
        MutationObserver: class { constructor(fn) { observer = fn; } observe() {} }
    });
    const flush = () => { const jobs = [...timers.values()]; timers.clear(); jobs.forEach(fn => fn()); };
    flush();
    return {
        groups, events, overlays, timers, document, mutation: records => observer(records),
        refresh() { observer([{ type: 'characterData' }]); flush(); },
        hits: () => groups.map(g => g.elements.flatMap((e, i) => e.style.getPropertyValue('fill') === '#FF0000' ? [i] : []))
    };
}
let checks = 0;
function test(name, fn) {
    try { fn(); checks++; } catch (error) { error.message = name + ': ' + error.message; throw error; }
}
function sequence(name, values, labels) {
    test(name, () => {
        const app = run([{ values, labels }]);
        assert.deepEqual(app.hits()[0], labels.flatMap((label, i) => label === 'S' ? [i] : []));
        app.groups[0].elements.forEach((element, i) => {
            if (labels[i] === 'S') {
                assert.equal(element.span.style.getPropertyValue('fill'), '#FF0000');
                assert.equal(element.style.getPropertyValue('font-weight'), 'bold');
                assert.equal(element.style.getPropertyPriority('fill'), 'important');
            }
        });
    });
}
sequence('single S without baseline', [700], ['S']);
sequence('couplet screenshot top-right', [998,1010,1026,1006,705,673,1215,1183,1187], ['N','N','N','N','S','S','N','N','N']);
sequence('couplet screenshot middle-left', [1046,1010,1054,597,573,1026,1311,1207,1147], ['N','N','N','S','S','N','N','N','N']);
sequence('couplet screenshot middle-right', [649,653,665,677,681,525,493,798,661,669,673,677,673,681], ['N','N','N','N','N','S','S','N','N','N','N','N','N','N']);
sequence('couplet screenshot bottom-left', [693,665,657,649,645,461,521,798,649,633,621,613,613,617,613], ['N','N','N','N','N','S','S','N','N','N','N','N','N','N','N']);
sequence('couplet screenshot bottom-right', [826,826,850,589,593,1026,934,930,890], ['N','N','N','S','S','N','N','N','N']);
sequence('second screenshot includes near-baseline S', [533,529,541,533,537,561,537,489,573,569,557,565,569,485,689,469,553,453,786,525,782,485,497,770,493,473,457,922,477,902,481,926,509,790], ['N','N','N','N','N','N','N','N','N','N','N','N','N','S','N','S','S','S','N','S','N','S','V','N','S','S','S','N','S','N','S','N','S','N']);
sequence('slow interval then normal must not highlight N', [730,1000,730,400,390], ['N','N','N','N','V']);
sequence('all S in a run including slow S', [729,697,770,501,661,489,437,401,617,381], ['N','N','N','S','N','S','S','S','S','S']);
sequence('blank first duration cannot shift pairing', [null,700,400,420], ['N','N','S','N']);
test('pair by index despite reversed label DOM order', () => {
    const app = run([{ values: [700,400,800], labels: ['N','S','V'] }]);
    app.groups[0].labels.reverse(); app.refresh();
    assert.deepEqual(app.hits(), [[1]]);
});
test('same indices in separate groups stay independent', () => {
    assert.deepEqual(run([{ values: [700,400], labels: ['N','S'] }, { values: [700,400], labels: ['S','N'] }]).hits(), [[1],[0]]);
});
test('complete-order fallback without D3 data', () => {
    assert.deepEqual(run([{ values: [null,700,400], labels: ['N','N','S'], noData: true }]).hits(), [[2]]);
});
test('mismatching counts cannot use order fallback', () => {
    assert.deepEqual(run([{ values: [700,400], labels: ['N','S','S'], noData: true }]).hits(), [[]]);
});
test('measurement range cannot become an S interval', () => {
    const app = run([{ values: [700], labels: ['S'] }]);
    app.groups[0].elements[0].__data__ = { index: [0,100], sec: 700, bpm: 85 };
    app.refresh(); assert.deepEqual(app.hits(), [[]]);
});
test('duplicate or missing index must not guess', () => {
    const app = run([{ values: [700,400], labels: ['N','S'] }]);
    app.groups[0].labels[0].__data__.index = 100;
    app.refresh(); assert.deepEqual(app.hits(), [[]]);
});
test('live text changes restore S-to-N and highlight N-to-S', () => {
    const app = run([{ values: [700,400], labels: ['N','S'] }]);
    app.groups[0].labels[0].textContent = 'S';
    app.groups[0].labels[1].textContent = 'N';
    app.refresh(); assert.deepEqual(app.hits(), [[0]]);
    const e = app.groups[0].elements[1];
    assert.equal(e.style.getPropertyValue('fill'), 'black');
    assert.equal(e.style.getPropertyValue('font-weight'), '');
    assert.equal(e.span.style.getPropertyValue('fill'), '');
});
test('preserve native non-S styles through repeated processing', () => {
    const app = run([{ values: [700], labels: ['V'] }]);
    const e = app.groups[0].elements[0];
    e.style.setProperty('fill', 'purple', 'important');
    e.style.setProperty('font-weight', '600');
    app.refresh(); assert.equal(e.style.getPropertyValue('fill'), 'purple');
    app.groups[0].labels[0].textContent = 'S'; app.refresh(); app.refresh();
    app.groups[0].labels[0].textContent = 'V'; app.refresh();
    assert.equal(e.style.getPropertyValue('fill'), 'purple');
    assert.equal(e.style.getPropertyPriority('fill'), 'important');
    assert.equal(e.style.getPropertyValue('font-weight'), '600');
});
test('changed index loses highlight until matching label exists', () => {
    const app = run([{ values: [700,400], labels: ['N','S'] }]);
    app.groups[0].labels[1].__data__.index = 200;
    app.refresh(); assert.deepEqual(app.hits(), [[]]);
});
test('average overlay and blur cleanup', () => {
    const app = run([{ values: [700,400], labels: ['N','S'] }]);
    app.events.keydown({ key: String.fromCharCode(96) });
    assert.equal(app.overlays[0].textContent, 'Avg: 100.00 bpm');
    app.events.blur(); assert.equal(app.overlays.length, 0);
});
test('input ignores shortcut', () => {
    const app = run([{ values: [700], labels: ['S'] }]);
    app.document.activeElement = { tagName: 'INPUT' };
    app.events.keydown({ key: String.fromCharCode(96) }); assert.equal(app.overlays.length, 0);
});
test('own overlays do not cause observer loop', () => {
    const app = run([{ values: [700], labels: ['S'] }]);
    app.mutation([{ type: 'childList', addedNodes: [{ nodeType: 1, classList: { contains: () => true } }], removedNodes: [] }]);
    assert.equal(app.timers.size, 0);
});
console.log(checks + ' checks passed (S-label DOM simulation; live RootiCare page not verified).');
