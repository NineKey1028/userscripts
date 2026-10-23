// 頁碼圓點：綠色選印與橘色強制選印都要分到所屬頁面，重複的只算一張。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../scripts/rooticare/RootiCare 標註快捷鍵.user.js'), 'utf8');
const grab = name => {
    const match = source.match(new RegExp(`    function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n    \\}\\n`));
    assert.ok(match, `${name} not found`);
    return match[0];
};
const getPrintPages = vm.runInNewContext(`${grab('toEventTime')}${grab('getPrintPages')}getPrintPages`);
const plain = value => JSON.parse(JSON.stringify(value));
const pageData = [[100, 110], [200, 210], [300, 310]];

// 只有橘色強制選印（之前圓點完全不顯示）。
assert.deepEqual(plain(getPrintPages({ pageData, events: [], preselectedEvents: [210, 210] })), {
    groups: [{ page: 2, times: [210], forced: 1 }], total: 1, forced: 1, pageCount: 3 });
// 綠橘混合；同時在兩邊的算一張並視為強制；section 也算綠色選印。
assert.deepEqual(plain(getPrintPages({ pageData, events: ['100', 210], section: [300], preselectedEvents: [210, 110] })), {
    groups: [{ page: 1, times: [100, 110], forced: 1 }, { page: 2, times: [210], forced: 1 }, { page: 3, times: [300], forced: 0 }],
    total: 4, forced: 2, pageCount: 3 });
// 沒有任何選印。
assert.deepEqual(plain(getPrintPages({ pageData, events: [] })), { groups: [], total: 0, forced: 0 });

// 強制選印即時讀取 printDialog.selectedEvents（與心電圖上的橘色圖示相同），不用開清單時的舊快照。
const { getLiveForcedEvents, estimatePrintMark } = vm.runInNewContext(
    `${source.match(/    const FORCED_PRINT_KEYS = \{[\s\S]*?\n    \};\n/)[0]}${grab('getLiveForcedEvents')}${grab('estimatePrintMark')}
    ({ getLiveForcedEvents, estimatePrintMark })`);
const af = type => ({ eventDialog: { dscp: { printedEventType: type } },
    printDialog: { selectedEvents: { longestAsleepPause: [210], longestAwakePause: [], longestVTTms: [300] } } });
assert.deepEqual([...getLiveForcedEvents(af('pauseTmsArr'))], [210]);
assert.deepEqual([...getLiveForcedEvents(af('vtTmsArr'))], [300]);
assert.equal(getLiveForcedEvents(af('tachyTmsArr')), null);
// Isolated 清單：子分類（Couplet 等）的選印不是強制選印。
const isolated = { eventDialog: { dscp: { printedEventType: 'pvcTmsArr' } },
    printDialog: { selectedEvents: { coupletTmsArr: [100], sveTmsArr: [200] } } };
assert.deepEqual([...getLiveForcedEvents(isolated)], []);
assert.deepEqual([...getLiveForcedEvents({ ...isolated, eventDialog: { dscp: { printedEventType: 'svebTmsArr' } } })], []);
assert.equal(getLiveForcedEvents(null), null);
// 取消排除後強制選印換成 210：圓點跟著換頁，舊的 preselectedEvents 不再使用。
const scope = { pageData, events: [], preselectedEvents: [100, 300] };
assert.deepEqual(plain(getPrintPages(scope, getLiveForcedEvents(af('pauseTmsArr')))).groups, [{ page: 2, times: [210], forced: 1 }]);

// 標記中心與網站拉條相同（310px、9 頁：第 1 頁 10、第 5 頁 155）。
assert.equal(estimatePrintMark(1, 9, 310), 10);
assert.equal(estimatePrintMark(5, 9, 310), 155);
assert.equal(estimatePrintMark(9, 9, 310), 300);
assert.equal(estimatePrintMark(2, 3, 310), 155);
console.log('PASS: forced print events grouped with selected ones');
