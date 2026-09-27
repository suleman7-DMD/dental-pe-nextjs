// Commute planner click-through. node scripts/check-commute-planner.cjs [URL]
const { chromium, expect } = require('@playwright/test')
;(async () => {
  const base = process.argv[2] || 'http://localhost:3104'
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--enable-unsafe-swiftshader'] })
  let failed = false
  for (const [label, viewport] of [['desktop', { width: 1500, height: 1050 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport, hasTouch: label === 'mobile' })
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    const calls = []; page.on('response', r => { if (r.url().includes('/api/commute?')) calls.push(r.status()) })
    try {
      await page.goto(base + '/directory?tab=map', { waitUntil: 'domcontentloaded', timeout: 120000 })
      await page.getByRole('button', { name: 'Commute planner', exact: true }).click({ timeout: 120000 })
      const panel = page.getByRole('region', { name: 'Commute planner' })
      await expect(panel).toBeVisible()
      await expect(panel.getByRole('button', { name: /Home/ })).toBeEnabled({ timeout: 60000 })
      await panel.getByRole('button', { name: /Home/ }).click()
      await expect(page.getByRole('status').filter({ hasText: 'home pin' })).toBeVisible()
      const box = await page.locator('.mapboxgl-canvas').boundingBox()
      const at = (fx, fy) => page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
      // picking collapses the sheet on mobile, so upper map area is clear
      await page.waitForTimeout(800)
      await at(label === 'mobile' ? .4 : .5, label === 'mobile' ? .35 : .45)
      await expect(page.getByRole('status').filter({ hasText: 'work pin' })).toBeVisible()
      await page.waitForTimeout(500)
      await at(label === 'mobile' ? .7 : .6, label === 'mobile' ? .55 : .6)
      const notice = await panel.getByRole('status').allTextContents()
      if (notice.length) console.log(label, 'NOTICE', notice)
      await expect(panel.getByRole('button', { name: 'Show morning commute' })).toBeVisible({ timeout: 60000 })
      await expect(page.getByRole('button', { name: 'Home pin. Drag to move.' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Work pin. Drag to move.' })).toBeVisible()
      const am = await panel.getByRole('button', { name: 'Show morning commute' }).innerText()
      await panel.getByRole('button', { name: 'Show evening commute' }).click()
      const pm = await panel.getByRole('button', { name: 'Show evening commute' }).innerText()
      await panel.getByRole('combobox', { name: 'Commute weekday' }).selectOption('5')
      await panel.getByRole('checkbox').check()
      await expect(panel.getByText(/Planned for Friday/)).toBeVisible({ timeout: 60000 })
      await panel.getByRole('button', { name: 'Swap home and work' }).click()
      await expect(panel.getByRole('button', { name: 'Show morning commute' })).toBeVisible({ timeout: 60000 })
      const hasRoute = await page.evaluate(() => !!document.querySelector('.mapboxgl-canvas'))
      if (process.env.OUT) await page.screenshot({ path: `${process.env.OUT}/commute-${label}.png` })
      console.log(label, 'AM', am.replaceAll('\n', ' | '), '|| PM', pm.replaceAll('\n', ' | '), 'calls', calls, 'errors', errors, hasRoute)
      await panel.getByRole('button', { name: 'Close commute planner' }).click()
      await expect(panel).toBeHidden()
      if (errors.length) throw new Error('page errors ' + errors)
      console.log('PASS', label)
    } catch (e) {
      failed = true; console.log('FAIL', label, e.message.split('\n').slice(0, 8).join('\n'))
      if (process.env.OUT) await page.screenshot({ path: `${process.env.OUT}/commute-${label}-fail.png` }).catch(() => {})
    }
  }
  await browser.close(); process.exit(failed ? 1 : 0)
})()
