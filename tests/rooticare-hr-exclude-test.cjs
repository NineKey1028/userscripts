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
console.log('PASS: HR exclusion filter');
