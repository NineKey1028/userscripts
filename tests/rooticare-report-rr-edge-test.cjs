const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../scripts/rooticare/RootiCare Report 檢查器.user.js'), 'utf8');
const config = source.slice(source.indexOf('    const CONFIG ='), source.indexOf('    let indicator;'));
const fn = source.slice(source.indexOf('    function getReportIntervalInfo('), source.indexOf('    function getMaxSinusTagFinding('));
const { getDisplayedIntervals, getReportIntervalInfo } = vm.runInNewContext(
    `${config}\n${fn}\n({ getDisplayedIntervals, getReportIntervalInfo })`);

// Mirrors the site's ecgRMarker: one .annoDuration per drawn beat, bound to that beat's index.
// The first label has no previous beat inside the strip; the site fills it from idxAdjust[0]
// (getDurationDiff over the whole fetched window), which can span a no-data gap.
const SAMPLE_RATE = 250;
function makeStrip({ title, beats, edgeMs, bind = true, idxStart = 0 }) {
    const pxOf = index => (index - idxStart) / (SAMPLE_RATE * 10) * 945;
    const card = { header: { innerText: title } };
    card.querySelector = () => card.header;
    const ecg = { closest: () => card };
    const marker = { closest: () => ecg };
    const beatNodes = beats.map(index => ({
        __data__: bind ? { index, type: 'N' } : undefined,
        getAttribute: name => (name === 'x' ? String(pxOf(index) - 4) : null),
    }));
    marker.querySelectorAll = selector => (selector === '.annoText' ? beatNodes : []);
    const labels = beats.map((index, i) => {
        const ms = i === 0 ? edgeMs : Math.floor((index - beats[i - 1]) / SAMPLE_RATE * 1000);
        const mid = i === 0 ? index / 2 : beats[i - 1] + (index - beats[i - 1]) / 2;
        return {
            __data__: bind ? index : undefined,
            childNodes: [{ textContent: ms ? String(ms) : '' }],
            querySelector: () => ({ textContent: ms ? String(Math.round(60000 / ms)) : '' }),
            closest: () => marker,
            getAttribute: name => (name === 'px' ? String(pxOf(mid)) : null),
        };
    });
    return { ecg, labels };
}

function run(strips, rrEcgs = []) {
    const report = {
        querySelectorAll: selector => (selector.includes('longestRRTms')
            ? rrEcgs.map(ecg => ({ querySelectorAll: () => [ecg] }))
            : strips.flatMap(strip => strip.labels)),
    };
    const intervals = getDisplayedIntervals(report);
    return { intervals, info: getReportIntervalInfo(report, intervals) };
}

// Event Tags strip at the start of a recording: blank lead-in, first beat 4 s into the strip,
// previous beat in the fetched data sits before the gap → fake 6.8 s edge label.
const edge = makeStrip({ title: 'Event Tags 01/02/2026 08:00:00', beats: [1000, 1200, 1400, 1600], edgeMs: 6800 });
let result = run([edge]);
assert.deepEqual(Array.from(result.intervals, item => item.milliseconds), [800, 800, 800],
    'Edge label fed by idxAdjust must be ignored, in-strip intervals kept');

// Same strip with absolute indices (report idxRange) and no d3 data bound: px fallback.
const unbound = makeStrip({ title: 'Event Tags', beats: [501000, 501200, 501400], edgeMs: 6800, bind: false, idxStart: 500000 });
result = run([unbound]);
assert.deepEqual(Array.from(result.intervals, item => item.milliseconds), [800, 800],
    'px fallback must also drop the edge label');

// A genuine long pause between two beats in the same strip is still reported.
const pause = makeStrip({ title: 'Pause 01/02/2026 09:00:00', beats: [200, 400, 1900, 2100], edgeMs: 800 });
const longest = makeStrip({ title: 'Longest R-R', beats: [200, 400, 1300, 1500], edgeMs: 9000 });
result = run([longest, pause, edge], [longest.ecg]);
assert.equal(result.info.milliseconds, 3600, 'Longest R-R baseline must not use its own fake edge label (9 s)');
assert.equal(Math.max(...result.intervals.map(item => item.milliseconds)), 6000, 'Real 6 s pause inside a strip must still count');
assert.equal(result.intervals.find(item => item.milliseconds === 6000).ecg, pause.ecg);

console.log('PASS: edge RR labels across no-data/recording boundary ignored, in-strip pauses kept');
