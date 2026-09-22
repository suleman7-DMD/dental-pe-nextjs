// Production smoke check: node scripts/check-socioeconomic-map.cjs [base URL]
// Optional PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH for an existing browser install.
const { chromium, expect } = require('@playwright/test')

;(async () => {
  const base = process.argv[2] || 'http://localhost:3101'
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--enable-unsafe-swiftshader'],
  })
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(base + '/directory?tab=map', { waitUntil: 'domcontentloaded', timeout: 60000 })
    const selector = page.getByRole('combobox', { name: 'Map layer', exact: true })
    await expect(selector).toHaveValue('population', { timeout: 60000 })
    await expect(page.getByText(/Loading older provider research/)).toBeHidden({ timeout: 60000 })
    await expect(page.getByText('Loading population tiles…', { exact: true })).toBeHidden({ timeout: 60000 })
    const counts = await page.locator('p[role="status"]').innerText()
    const data = await page.request.get(base + '/data/chicagoland-acs-2024.geojson')
    expect(data.ok()).toBe(true)
    expect((await data.json()).features).toHaveLength(2339)
    const canvas = page.locator('.mapboxgl-canvas')
    const dots = page.getByRole('checkbox', { name: 'Show practice dots', exact: true })
    const popup = page.locator('.mapboxgl-popup-content')
    for (const metric of ['income', 'education']) {
      await selector.selectOption(metric)
      await expect(page.getByText('Loading Census tract estimates…', { exact: true })).toBeHidden({ timeout: 60000 })
      await expect(page.getByText(/Census layer is unavailable/)).toHaveCount(0)
      await expect(page.getByText(metric === 'income' ? 'Annual household income · 2024 dollars · Census ACS 2020–2024' : 'Share of adults age 25+ · percent · Census ACS 2020–2024', { exact: true })).toBeVisible()
      await expect(page.getByRole('slider', { name: 'Layer opacity' })).toBeEnabled()
      await dots.uncheck()
      await canvas.scrollIntoViewIfNeeded()
      const box = await canvas.boundingBox()
      // Find a land tract in the initial Chicago viewport; don't depend on one pixel.
      let found = false
      for (const x of [0.55, 0.45, 0.65, 0.35]) {
        await page.mouse.move(box.x + box.width * x, box.y + box.height * 0.5)
        try { await expect(popup).toContainText('90% margin of error:', { timeout: 3000 }); found = true; break } catch {}
      }
      expect(found).toBe(true)
      await expect(popup).toContainText(metric === 'income' ? 'Median household income' : 'Education: bachelor’s degree or higher')
      await expect(popup).toContainText(metric === 'income' ? '±$' : 'percentage points')
      console.log(metric.toUpperCase(), await popup.innerText())
      await dots.check()
      await expect(page.locator('p[role="status"]')).toHaveText(counts)
      await canvas.scrollIntoViewIfNeeded()
      await page.screenshot({ path: `/tmp/dental-${metric}-map.png` })
    }
    await selector.selectOption('none')
    await expect(page.getByRole('slider', { name: 'Layer opacity' })).toBeDisabled()
    await expect(popup).toHaveCount(0)
    await selector.selectOption('population')
    await expect(page.getByText('People per square mile · WorldPop 2026 modeled population', { exact: true })).toBeVisible()
    await expect(page.locator('p[role="status"]')).toHaveText(counts)
    expect(errors).toEqual([])
    console.log('PASS: both rendered layers, tract hover values/MOE, practice toggles, unchanged counts, population restored; no browser errors.')

    const failed = await browser.newPage()
    await failed.route('**/data/chicagoland-acs-2024.geojson', route => route.fulfill({ status: 503, body: 'Unavailable' }))
    await failed.goto(base + '/directory?tab=map', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await failed.getByRole('combobox', { name: 'Map layer', exact: true }).selectOption('income', { timeout: 60000 })
    await expect(failed.getByText(/Census layer is unavailable/)).toBeVisible({ timeout: 60000 })
    await expect(failed.locator('p[role="status"]')).toContainText('offices mapped')
    console.log('PASS: failed Census request visibly warned; office layer retained.')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
