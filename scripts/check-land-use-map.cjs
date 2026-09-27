// Browser acceptance: node scripts/check-land-use-map.cjs [base URL]
const { chromium, expect } = require('@playwright/test')
;(async () => {
  const base = process.argv[2] || 'http://localhost:3102'
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--enable-unsafe-swiftshader'] })
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1200 } })
    const errors = []
    const tileRequests = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('request', r => { if (r.url().includes('/api/land-use-tiles/')) tileRequests.push(r.url()) })
    await page.goto(base + '/directory?tab=map', { waitUntil: 'domcontentloaded', timeout: 120000 })
    const selector = page.getByRole('combobox', { name: 'Map layer', exact: true })
    await expect(selector).toHaveValue('population', { timeout: 120000 })
    await expect(page.getByText(/Loading older provider research/)).toBeHidden({ timeout: 120000 })
    expect(tileRequests.length).toBe(0)
    const counts = await page.locator('p[role="status"]').innerText()
    await selector.selectOption('landuse')
    await expect(page.getByText('Land-use tiles loaded', { exact: true })).toBeVisible({ timeout: 120000 })
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(tileRequests.length).toBeGreaterThan(0)
    const canvas = page.locator('.mapboxgl-canvas')
    const dots = page.getByRole('checkbox', { name: 'Show practice dots', exact: true })
    await dots.uncheck()
    await canvas.scrollIntoViewIfNeeded()
    const box = await canvas.boundingBox()
    let found = false
    for (const x of [0.4, 0.5, 0.6, 0.3, 0.7]) {
      for (const y of [0.3, 0.5, 0.7]) {
        await page.mouse.move(box.x + box.width * x, box.y + box.height * y)
        try { await expect(page.locator('.mapboxgl-popup-content')).toContainText('CMAP · 2023 land use', { timeout: 1500 }); found = true; break } catch {}
      }
      if (found) break
    }
    expect(found).toBe(true)
    console.log('LAND HOVER', await page.locator('.mapboxgl-popup-content').innerText())
    await dots.check()
    await page.mouse.move(0, 0)
    await page.screenshot({ path: '/tmp/dental-land-use-full.png', fullPage: true })
    for (const [label, mode] of [['Where people live', 'homes'], ['Commercial & medical', 'sites'], ['Full land use', 'full']]) {
      await page.getByRole('button', { name: label, exact: true }).click()
      await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true')
      expect(new URL(page.url()).searchParams.get('landUse')).toBe(mode)
      await expect(page.locator('p[role="status"]')).toHaveText(counts)
      await page.mouse.move(0, 0)
      await canvas.scrollIntoViewIfNeeded()
      await page.waitForTimeout(700)
      await page.screenshot({ path: `/tmp/dental-land-use-${mode}.png`, fullPage: true })
    }
    await page.getByRole('button', { name: 'Where people live', exact: true }).click()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(selector).toHaveValue('landuse', { timeout: 120000 })
    await expect(page.getByRole('button', { name: 'Where people live', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Land-use tiles loaded', { exact: true })).toBeVisible({ timeout: 120000 })
    await selector.selectOption('income')
    await expect(page.getByText('Annual household income · 2024 dollars · Census ACS 2020–2024', { exact: true })).toBeVisible()
    await expect(page.locator('.mapboxgl-popup-content')).toHaveCount(0)
    await selector.selectOption('none')
    await expect(page.getByRole('slider', { name: 'Layer opacity' })).toBeDisabled()
    expect(errors).toEqual([])
    console.log('PASS lazy loading, rendering, hover, three views, counts unchanged, URL restoration, prior layers and no browser exceptions')

    const failed = await browser.newPage()
    await failed.route('**/api/land-use-tiles/**', r => r.fulfill({ status: 503, body: 'Unavailable' }))
    await failed.goto(base + '/directory?tab=map&mapLayer=landuse', { waitUntil: 'domcontentloaded', timeout: 120000 })
    await expect(failed.getByRole('alert')).toContainText('Land-use tiles are unavailable', { timeout: 120000 })
    await expect(failed.locator('p[role="status"]')).toContainText('offices mapped')
    await failed.unroute('**/api/land-use-tiles/**')
    await failed.getByRole('button', { name: 'Retry land-use layer' }).click()
    await expect(failed.getByText('Land-use tiles loaded', { exact: true })).toBeVisible({ timeout: 120000 })
    await expect(failed.getByRole('alert')).toHaveCount(0)
    console.log('PASS outage visibly warned and retry recovered')
    await page.setViewportSize({ width: 390, height: 844 })
    await selector.selectOption('landuse')
    await expect(page.getByRole('button', { name: 'Where people live', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: '/tmp/dental-land-use-mobile.png', fullPage: true })
    console.log('PASS mobile controls and no horizontal overflow')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
