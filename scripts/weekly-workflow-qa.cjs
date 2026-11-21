const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

// Prefer the test runner's own package. The workstation also has a shared installation.
const sharedPlaywright = 'X:/Codex/RuntimeDependencies/codex-primary-runtime/dependencies/node/node_modules/playwright';
let playwrightPath = process.env.DAYSTAGE_PLAYWRIGHT;
if (!playwrightPath) {
  try {
    playwrightPath = require.resolve('playwright');
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND' || !existsSync(sharedPlaywright)) throw error;
    playwrightPath = sharedPlaywright;
  }
}
const { chromium } = require(playwrightPath);
const root = path.resolve(__dirname,'..');
const canonical = path.join(root,'daystage_mvp_package','daystage_mvp.html');
const source = existsSync(canonical) ? canonical : path.join(root,'index.html');
const target = process.argv[2];
const output = path.resolve(process.argv[3] || process.env.DAYSTAGE_QA_OUTPUT || path.join(os.tmpdir(),'daystage-weekly-qa',target ? 'hosted' : 'local'));
const sizes = {poster: [1080,1440], desktop: [2560,1440], phone: [1080,2340]};
const monday = '2026-11-23';
const ordinary = [
  ['0','09:00','Coffee with Mia'],
  ['0','15:30','Band practice'],
  ['6','18:45','Dinner at home'],
];
const densePlans = [
  'Pack the spare charger and notebook before leaving for campus',
  'Meet Mia outside the library to return her borrowed poetry collection',
  'Print the revised programme and check the hall booking with Jamie',
  'Send the final illustration and page numbers to the magazine editor',
  'Pick up the repaired headphones from the little shop near the station',
  'Read the assigned chapter and mark questions for the group discussion',
  'Buy the ingredients for dinner and label the bags for each recipe',
  'Join the poster workshop and bring a sample from the morning session',
  'Listen to the rehearsal recording and mark the first chorus entrance',
  'Walk through the exhibition with Sam and photograph the display labels',
  'Reserve the study room and share the confirmation with the project group',
  'Collect the prints from the studio and sort them into labelled folders',
  'Take the evening train home and call the neighbour about the delivery',
  'Lay out tomorrow’s materials and leave the signed paperwork by the door',
];

async function localStudio() {
  const html = await fs.readFile(source);
  const server = http.createServer((req,res) => {
    if (req.url.split('?')[0] !== '/daystage_mvp.html') return res.writeHead(404).end();
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}).end(html);
  });
  await new Promise((resolve,reject) => {
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  return {server, url:'http://127.0.0.1:' + server.address().port + '/daystage_mvp.html'};
}

async function ready(page) {
  await page.waitForFunction(() => document.getElementById('quickDownload')?.disabled === false);
  await page.evaluate(() => document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
}

async function blankWeek(page) {
  const remove = page.locator('#weekTasks .week-remove');
  while (await remove.count() > 1) await remove.last().click();
  assert((await page.locator('#weekTasks .week-event').count()) <= 1);
}

async function enterRows(page, rows) {
  for (const [index,[day,time,event]] of rows.entries()) {
    if (await page.locator('#weekTasks .week-event').count() <= index) await page.locator('#weekAdd').click();
    await page.locator('#weekTasks .week-day').nth(index).selectOption(day);
    await page.locator('#weekTasks .week-time').nth(index).fill(time);
    await page.locator('#weekTasks .week-event').nth(index).fill(event);
  }
  await page.locator('#weekTitle').focus();
}

async function readRows(page) {
  const list = key => page.locator('#weekTasks .week-' + key).evaluateAll(inputs => inputs.map(input => input.value));
  const [days,times,events] = await Promise.all(['day','time','event'].map(list));
  return events.map((event,i) => [days[i],times[i],event]);
}

async function openWeek(page, date) {
  await page.locator('#weeklyMode').click();
  await page.locator('#weekPanel').waitFor({state:'visible'});
  await page.locator('#weekDate').fill(date);
  await page.locator('#weekTitle').focus();
  await page.waitForFunction(expected => document.getElementById('weekDate').value === expected,monday);
}

async function checkRenderedWeek(canvas, rows, start) {
  const layout = await canvas.evaluate(c => ({
    width:c.width/2, height:c.height/2,
    complete:c.__dsWeekLayout.complete, days:c.__dsWeekLayout.days,
  }));
  assert.equal(layout.days.length,7);
  assert.equal(layout.complete,true,'The weekly renderer reported that some text did not fit');
  const joinLines = lines => lines.join(' ').replace(/\s+/g,' ').trim();
  for (const [index, day] of layout.days.entries()) {
    const expectedDate = new Date(start + 'T12:00:00Z');
    expectedDate.setUTCDate(expectedDate.getUTCDate() + index);
    assert.equal(day.date,expectedDate.toISOString().slice(0,10));
    assert.equal(day.index,index);
    assert(day.y >= 0 && day.y + day.height <= layout.height + 1,'Day crosses the canvas edge');
    const expected = rows.filter(row => Number(row[0]) === index);
    assert.deepEqual(day.items.map(item => [item.time,item.text]),expected.map(row => row.slice(1)));
    let lastBaseline = day.y;
    for (const item of day.items) {
      assert.equal(joinLines(item.lines),item.text,'Wrapped title is incomplete');
      assert.equal(item.timeLines.join(''),item.time,'Wrapped time is incomplete');
      assert(item.x > 0 && item.x < layout.width);
      assert(item.y > lastBaseline,'Entries overlap within a day');
      lastBaseline = item.y + (Math.max(item.lines.length,item.timeLines.length) - 1) * day.fontSize * 1.22;
      assert(lastBaseline <= day.y + day.height + 1,'Last line crosses its day boundary');
    }
  }
  return {days:layout.days.length,visibleEntries:rows.length,minFontLogicalPx:Math.min(...layout.days.filter(d => d.items.length).map(d => d.fontSize))};
}

async function downloadSizes(page, prefix, rows) {
  const cases = [];
  const canvas = page.locator('#poster');
  for (const [format,[width,height]] of Object.entries(sizes)) {
    await page.locator('#quickFormat').selectOption(format);
    await page.waitForFunction(([w,h]) => {
      const c = document.getElementById('poster');
      return c.width === w && c.height === h;
    }, [width,height]);
    await ready(page);
    const rendering = await checkRenderedWeek(canvas,rows,monday);
    const preview = Buffer.from(await canvas.evaluate(c => c.toDataURL('image/png').split(',')[1]),'base64');
    const [download] = await Promise.all([page.waitForEvent('download'),page.locator('#quickDownload').click()]);
    const file = path.join(output,prefix + '-' + format + '.png');
    await download.saveAs(file);
    const png = await fs.readFile(file);
    assert.equal(png.readUInt32BE(16),width);
    assert.equal(png.readUInt32BE(20),height);
    assert(png.equals(preview),prefix + ' ' + format + ' differs from the preview captured before download');
    cases.push({format,width,height,bytes:png.length,sha256:createHash('sha256').update(png).digest('hex'),matchesPreview:true,rendering,file:path.basename(file)});
  }
  return cases;
}

async function mobileTest(browser, url, errors) {
  const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,acceptDownloads:true});
  page.setDefaultTimeout(12000);
  page.on('pageerror',error => errors.push(error.message));
  const response = await page.goto(url);
  assert(response && response.ok(),'Editor page did not load');
  const sourceSha256 = createHash('sha256').update(await response.body()).digest('hex');
  await ready(page);
  await page.locator('#tasks .event').first().fill('Walk to the studio');
  await page.locator('#tasks .time').first().fill('08:45');
  await page.locator('#quickFormat').selectOption('desktop');
  const original = await page.evaluate(() => localStorage.getItem('daystage-v1'));
  assert(original?.includes('Walk to the studio'));
  await openWeek(page,'2026-11-25');
  await blankWeek(page);
  await page.locator('#weekTitle').fill('A week on campus');
  await enterRows(page,ordinary);
  assert.deepEqual(await readRows(page),ordinary);
  await page.locator('#weekPanel').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'mobile-input.png')});
  const weekRange = await page.locator('#weekRange').innerText();
  assert(weekRange.includes('23') && weekRange.includes('29'),weekRange);
  await page.locator('#weekNext').tap();
  assert.equal(await page.locator('#weekDate').inputValue(),'2026-11-30');
  assert(!(await readRows(page)).some(row => row[2] === ordinary[0][2]));
  await blankWeek(page);
  await enterRows(page,[['2','13:15','Meet the new class']]);
  await page.locator('#weekPrev').tap();
  assert.deepEqual(await readRows(page),ordinary);
  assert.equal(await page.locator('#weekTitle').inputValue(),'A week on campus');
  await page.reload();
  await ready(page);
  assert(await page.locator('#weekPanel').isVisible());
  assert.equal(await page.locator('#weekDate').inputValue(),monday);
  assert.deepEqual(await readRows(page),ordinary);
  const exports = await downloadSizes(page,'mobile',ordinary);
  await page.reload();
  await ready(page);
  assert.equal(await page.locator('#quickFormat').inputValue(),'phone');
  assert.deepEqual(await readRows(page),ordinary);
  const reloadedPng = Buffer.from(await page.locator('#poster').evaluate(c => c.toDataURL().split(',')[1]),'base64');
  assert.equal(createHash('sha256').update(reloadedPng).digest('hex'),exports.find(item => item.format === 'phone').sha256);
  await page.locator('#poster').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'mobile-preview.png')});
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),'390 px viewport overflow');
  await page.locator('#dailyMode').tap();
  assert.equal(await page.locator('#tasks .time').first().inputValue(),'08:45');
  assert.equal(await page.locator('#tasks .event').first().inputValue(),'Walk to the studio');
  assert.equal(await page.locator('#quickFormat').inputValue(),'desktop');
  assert.equal(await page.evaluate(() => localStorage.getItem('daystage-v1')),original);
  await page.locator('#weeklyMode').tap();
  await page.locator('#weekNext').tap();
  assert.deepEqual(await readRows(page),[['2','13:15','Meet the new class']]);
  await ready(page);
  const nextWeek = await checkRenderedWeek(page.locator('#poster'),[['2','13:15','Meet the new class']],'2026-11-30');
  await page.close();
  return {viewport:'390 × 844 touch emulation',sourceSha256,monday,ordinary,weekRange,dailyDraftRestored:true,weekSwitchAndReload:true,repeatPngMatches:true,nextWeek,exports};
}

async function desktopTest(browser, url, errors) {
  const page = await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  page.setDefaultTimeout(12000);
  page.on('pageerror',error => errors.push(error.message));
  await page.goto(url.split('#')[0]+'#studio');
  await ready(page);
  await openWeek(page,monday);
  await blankWeek(page);
  await page.locator('#weekTasks .week-remove').last().click();
  assert.deepEqual(await readRows(page),[]);
  await page.locator('#weekTitle').fill('Rehearsal and print week');
  const dense = densePlans.map((event,i) => ['4',String(i + 7).padStart(2,'0') + ':30',event]);
  await enterRows(page,dense);
  assert.deepEqual(await readRows(page),dense);
  assert(await page.locator('#weekAdd').isDisabled(),'Weekly row limit should stop extra entries');
  const exports = await downloadSizes(page,'desktop-dense',dense);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),'Desktop page overflow');
  await page.locator('#quickFormat').selectOption('desktop');
  await page.locator('#poster').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'desktop-dense-preview.png')});
  const note = page.locator('#fitNote');
  const fitNote = (await note.count()) && await note.isVisible() ? await note.innerText() : '';
  await page.close();
  return {viewport:'1440 × 1000',dense,fitNote,exports};
}

(async () => {
  await fs.mkdir(output,{recursive:true});
  const local = target ? null : await localStudio();
  const url = target || local.url;
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({channel:process.env.DAYSTAGE_BROWSER_CHANNEL || undefined,headless:true});
    const mobile = await mobileTest(browser,url,errors);
    const desktop = await desktopTest(browser,url,errors);
    assert.deepEqual(errors,[]);
    const report = {passed:true,testedAt:new Date().toISOString(),url,mobile,desktop,errors};
    await fs.writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2));
    console.log('PASS: two independent weeks, daily draft preserved, six PNG downloads identical to preview. ' + output);
  } finally {
    if (browser) await browser.close();
    if (local) local.server.close();
  }
})().catch(error => { console.error(error.stack); process.exitCode=1; });
