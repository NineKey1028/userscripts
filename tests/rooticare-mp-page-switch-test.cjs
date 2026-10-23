// Run RootiCare MP 快速切頁 against a minimal MP page with fake timers:
// - Q / E at a page edge waits for the page's waveforms, then switches type.
// - Page changes queue while the previous page is still loading.
// - After the site's 'waveformData' error the current page is reloaded and the stuck loading flag cleared.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../scripts/rooticare/RootiCare MP 快速切頁.user.js'), 'utf8');

function setup({ page = 1, pageCount = 3, segments, labels }) {
    let now = 0, nextId = 1;
    const timers = new Map();
    const schedule = (fn, ms, repeat) => { const id = nextId++; timers.set(id, { at: now + (ms || 0), fn, repeat: repeat ? ms : 0 }); return id; };
    function advance(ms) {
        const end = now + ms;
        for (;;) {
            const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
            if (!due) break;
            const [id, t] = due;
            now = t.at;
            if (t.repeat) t.at += t.repeat; else timers.delete(id);
            t.fn();
        }
        now = end;
    }

    const clicks = [], pageCalls = [], logged = [];
    const container = {};
    const types = [0, 1, 2].map(i => ({
        selected: i === 1,
        querySelector(s) { return s === '.selectedBackground' && this.selected ? {} : null; },
        dispatchEvent() {},
        click() { clicks.push(i); },
        scrollIntoView() {}
    }));
    const scope = {
        $apply(fn) { fn(); },
        loading: () => false,
        // Like the site: switch the thumbnail list now, waveforms and labels arrive later.
        pageChanged() {
            const p = scope.morphology.pagination.currentPage;
            pageCalls.push(p);
            scope.morphology.state.currentSegments = [{ absoluteIndex: p * 100 }];
        },
        morphology: {
            loading: { segments: false },
            pagination: { currentPage: page, pageCount },
            state: { label: 'V', type: '3', currentSegments: segments.map(absoluteIndex => ({ absoluteIndex })), selectedSegments: [] },
            ecgEnlargedChart: { annoData: labels }
        }
    };
    const $log = { error(...args) { logged.push(args); } };
    const listeners = {};
    const document = {
        head: { appendChild() {} },
        body: {},
        activeElement: null,
        createElement: () => ({}),
        addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
        querySelector: s => s === '.morphology > .container' ? container : null,
        querySelectorAll: s => s === '.type-trend' ? types : []
    };
    const window = { angular: { element: el => ({
        scope: () => (el === container ? scope : null),
        injector: () => (el === document.body ? { get: name => (name === '$log' ? $log : null) } : null)
    }) } };
    vm.runInNewContext(source, {
        window, document, Element: function Element() {}, MouseEvent: function MouseEvent() {}, getComputedStyle: () => ({}),
        setTimeout: (fn, ms) => schedule(fn, ms, false), clearTimeout: id => timers.delete(id),
        setInterval: (fn, ms) => schedule(fn, ms, true), Date: { now: () => now }
    });
    function press(key) {
        const e = { key, prevented: false, target: null, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} };
        listeners.keydown.forEach(fn => fn(e));
        return e;
    }
    // Simulate the site finishing the load of the current page.
    function load() { scope.morphology.ecgEnlargedChart.annoData = scope.morphology.state.currentSegments.map(s => ({ [s.absoluteIndex]: 'N' })); }
    return { press, load, advance, clicks, pageCalls, scope, $log, logged, listeners };
}

// Last page still loading: E is held, then switches type once the page has loaded.
{
    const t = setup({ page: 6, pageCount: 6, segments: [600, 610], labels: [{ 500: 'N' }, { 510: 'N' }] });
    const e = t.press('e');
    assert.ok(e.prevented, 'key is taken over while loading');
    t.advance(100);
    assert.deepEqual(t.clicks, [], 'no switch before the page loads');
    t.load();
    t.advance(40);
    assert.deepEqual(t.clicks, [2], 'switches to the next type after loading');
}

// Labels cleared by the site's network fallback count as loading; Q waits as well.
{
    const t = setup({ page: 1, segments: [100, 110], labels: [] });
    t.press('q');
    t.load();
    t.advance(40);
    assert.deepEqual(t.clicks, [0]);
}

// A held switch is cancelled by another key, by a mouse click, by a page change, or by timing out.
{
    const t = setup({ page: 6, pageCount: 6, segments: [600], labels: [{ 500: 'N' }] });
    t.press('e'); t.press('a'); t.load(); t.advance(40);
    assert.deepEqual(t.clicks, [], 'another key cancels');

    const m = setup({ page: 6, pageCount: 6, segments: [600], labels: [{ 500: 'N' }] });
    m.press('e'); m.listeners.mousedown.forEach(fn => fn({})); m.load(); m.advance(40);
    assert.deepEqual(m.clicks, [], 'a mouse click cancels');

    const p = setup({ page: 1, segments: [100], labels: [{ 1: 'N' }] });
    p.press('q'); p.scope.morphology.pagination.currentPage = 2; p.load(); p.advance(40);
    assert.deepEqual(p.clicks, [], 'a page change cancels');

    const o = setup({ page: 6, pageCount: 6, segments: [600], labels: [{ 500: 'N' }] });
    o.press('e'); o.advance(3100); o.load(); o.advance(40);
    assert.deepEqual(o.clicks, [], 'gives up after the wait limit');
}

// Not at an edge: the key is left to the site.
{
    const t = setup({ page: 2, segments: [200], labels: [{ 100: 'N' }] });
    const e = t.press('e');
    t.load(); t.advance(40);
    assert.deepEqual(t.clicks, []);
    assert.ok(!e.prevented, 'normal paging stays with the site');
}

// Page changes queue while the previous page is loading and run once, with the latest page number.
{
    const t = setup({ page: 4, segments: [400], labels: [{ 400: 'N' }] });
    t.advance(500); // guard installed by the periodic check
    const m = t.scope.morphology;
    m.pagination.currentPage = 5;
    t.scope.pageChanged();
    assert.deepEqual(t.pageCalls, [5], 'runs immediately when the previous page is loaded');
    m.pagination.currentPage = 4; t.scope.pageChanged();
    m.pagination.currentPage = 3; t.scope.pageChanged();
    t.advance(100);
    assert.deepEqual(t.pageCalls, [5], 'queued while page 5 is loading');
    t.load(); t.advance(40);
    assert.deepEqual(t.pageCalls, [5, 3], 'runs once with the latest page');
}

// Recovery: after the site's error, reload the current page and clear the stuck loading flag.
{
    const t = setup({ page: 1, segments: [100, 110], labels: [{ 1: 'N' }] });
    t.advance(500);
    const m = t.scope.morphology;
    m.loading.segments = true;
    t.$log.error(new TypeError("Cannot read properties of undefined (reading 'waveformData')"), 'Possibly unhandled rejection: {}');
    assert.equal(t.logged.length, 1, 'the error still reaches the site');
    t.advance(150);
    assert.deepEqual(t.pageCalls, [], 'waits briefly before reloading');
    t.$log.error(new TypeError("Cannot read properties of undefined (reading 'waveformData')"));
    t.advance(150);
    assert.deepEqual(t.pageCalls, [], 'each error restarts the delay');
    t.advance(60);
    assert.deepEqual(t.pageCalls, [1], 'reloads the current page through the site');
    t.load(); t.advance(40);
    assert.equal(m.loading.segments, false, 'stuck loading flag cleared');
}

// No recovery when the page is fine, or for unrelated errors.
{
    const t = setup({ page: 1, segments: [100], labels: [{ 100: 'N' }] });
    t.advance(500);
    t.$log.error(new TypeError("Cannot read properties of undefined (reading 'waveformData')"));
    t.advance(1000);
    const u = setup({ page: 1, segments: [100], labels: [] });
    u.advance(500);
    u.$log.error(new Error('something else'));
    u.advance(1000);
    assert.deepEqual([...t.pageCalls, ...u.pageCalls], []);
}

console.log('rooticare-mp-page-switch-test: ok');
