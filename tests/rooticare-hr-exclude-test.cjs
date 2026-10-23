// HR 清單排除：依錨點重算保留的心電圖，取消單一錨點時其餘排除保持。
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
const filterHRItems = vm.runInNewContext(`const HR_EXCLUDE_SECONDS = 60;
${grab('toEventTime')}${grab('filterHRItems')}filterHRItems`);

// 排序後的清單（數值為起始秒數）。
const all = [1000, 1030, 5000, 1050, 5040, 9000, 1200, 5100];
assert.deepEqual([...filterHRItems(all, [])], all);
// 錨點 1000 移除後面 ±60 秒內的 1030、1050；1200 超過 60 秒保留。
assert.deepEqual([...filterHRItems(all, [1000])], [1000, 5000, 5040, 9000, 1200, 5100]);
// 兩個錨點都排除。
assert.deepEqual([...filterHRItems(all, [1000, 5000])], [1000, 5000, 9000, 1200, 5100]);
// 取消 1000 的排除，5000 的排除仍在。
assert.deepEqual([...filterHRItems(all, [5000])], [1000, 1030, 5000, 1050, 9000, 1200, 5100]);
// 只移除排在錨點後面的；排在前面的相近時間保留。
assert.deepEqual([...filterHRItems(all, [1030])], [1000, 1030, 5000, 5040, 9000, 1200, 5100]);
// 錨點不在清單中時略過。
assert.deepEqual([...filterHRItems(all, [7777])], all);

// AF 時段排除：每個 AF 區塊涵蓋起點後 60 秒，10 秒心電圖與其重疊即排除。
const excludeAFItems = vm.runInNewContext(`const HR_STRIP_SECONDS = 10; const AF_BLOCK_SECONDS = 60;
${grab('toEventTime')}${grab('excludeAFItems')}excludeAFItems`);
const afMinutes = [2000, 2060, 4000];
const strips = [1980, 1989, 1990, 1991, 2050, 2119, 2120, 2125, 3995, 4059, 4060, 9000];
// 1990 起的 10 秒剛好結束於 2000（不重疊）；1991 起才碰到 2000。2120 起剛好在 2060 區塊結束時。
assert.deepEqual([...excludeAFItems(strips, afMinutes)], [1980, 1989, 1990, 2120, 2125, 4060, 9000]);
assert.deepEqual([...excludeAFItems(strips, [])], strips);
assert.deepEqual([...excludeAFItems([{ startTime: 2010 }, { startTime: 3000 }], afMinutes)].map(v => v.startTime), [3000]);
console.log('PASS: HR exclusion filter');
