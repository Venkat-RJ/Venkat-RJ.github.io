"""Exercise the actual browser workbench, including exports and responsive layouts.

python browser_smoke.py path/to/index.html --artifacts artifacts/recursivecal-ui
With no HTML argument, use the CAD viewer's generated standalone build.
"""
import argparse
import asyncio
import csv
import json
import math
from pathlib import Path

from playwright.async_api import async_playwright


async def run(html: Path, artifacts: Path):
    artifacts.mkdir(parents=True, exist_ok=True)
    errors = []
    findings = {}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
        )
        page = await browser.new_page(viewport={'width': 1536, 'height': 1000}, device_scale_factor=1)
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            await page.goto(html.resolve().as_uri(), wait_until='load')
            await page.wait_for_function('window.__recursivecal?.state.factoryRun', timeout=30000)
            findings['initial'] = await page.evaluate('''() => ({
                parts: window.__recursivecal.scene?.parts.length,
                frames: window.__recursivecal.state.factoryRun.frames.length,
                renderer: window.__recursivecal.scene?.software ? 'software' : 'WebGL2',
                time: window.__recursivecal.state.time,
                title: document.title
            })''')
            assert findings['initial']['parts'] >= 50, findings['initial']
            assert findings['initial']['frames'] == 218, findings['initial']
            assert 'Workbench' in findings['initial']['title']
            await page.screenshot(path=str(artifacts / 'desktop.png'), full_page=True)

            await page.locator('#runBtn').click()
            await page.wait_for_function('window.__recursivecal.state.time > 0.08 && window.__recursivecal.state.playing')
            await page.locator('#runBtn').click()
            assert await page.locator('#testState').inner_text() == 'Paused'
            await page.locator('#resetBtn').click()
            assert await page.evaluate('window.__recursivecal.state.time') == 0
            assert await page.locator('#testState').inner_text() == 'Ready'

            findings['scenarios'] = []
            for fault in ['nominal', 'hinge_friction', 'motor_fade', 'heavy_hatch', 'sensor_bias', 'gas_leak', 'combined']:
                await page.locator('#faultSelect').select_option(fault)
                await page.locator('#suggestBtn').click()
                result = await page.evaluate('''() => {
                    const s = window.__recursivecal.state;
                    return {
                        fault: s.fault, controller: s.controller,
                        factory: s.factoryRun.metrics.mae_deg,
                        modified: s.tunedRun.metrics.mae_deg,
                        slider: Number(document.getElementById('gravityInput').value),
                        gravity: s.cal.gravity_comp,
                        finite: [...s.factoryRun.frames, ...s.tunedRun.frames].every(f => Object.values(f).every(Number.isFinite))
                    };
                }''')
                assert result['fault'] == fault and result['controller'] == 'tuned', result
                assert result['finite'], result
                assert math.isclose(result['slider'], result['gravity']), result
                findings['scenarios'].append(result)

            await page.locator('#compareBtn').click()
            await page.locator('#scrubber').evaluate("el => { el.value='4.2'; el.dispatchEvent(new Event('input', {bubbles:true})); }")
            assert await page.evaluate('window.__recursivecal.state.compare')
            assert await page.locator('#compareHalf').is_visible()
            findings['comparison'] = await page.evaluate('''() => ({
                factory: window.__recursivecal.state.factoryRun.metrics.final_angle_deg,
                modified: window.__recursivecal.state.tunedRun.metrics.final_angle_deg,
                time: window.__recursivecal.state.time
            })''')
            assert findings['comparison']['factory'] < findings['comparison']['modified']
            await page.screenshot(path=str(artifacts / 'comparison.png'), full_page=True)
            await page.locator('#compareBtn').click()
            await page.locator('#viewMech').click()
            await page.locator('#toggleLabels').click()
            assert await page.locator('#callouts').is_visible()
            await page.screenshot(path=str(artifacts / 'cutaway.png'), full_page=True)
            await page.locator('#toggleLabels').click()
            await page.locator('#viewVehicle').click()

            for signal in ['current', 'torque', 'angle']:
                await page.locator(f'[data-signal="{signal}"]').click()
                assert await page.evaluate('window.__recursivecal.state.signal') == signal
                assert await page.locator(f'[data-signal="{signal}"]').get_attribute('aria-pressed') == 'true'
            await page.locator('#plot').press('End')
            assert await page.evaluate('window.__recursivecal.state.time') == 6.5
            await page.locator('#plot').press('Home')
            assert await page.evaluate('window.__recursivecal.state.time') == 0
            await page.locator('#speedSelect').select_option('2')
            await page.locator('#runBtn').click()
            await page.wait_for_function('window.__recursivecal.state.time === 6.5 && !window.__recursivecal.state.playing', timeout=15000)
            assert await page.locator('#testState').inner_text() == 'Complete'

            async with page.expect_download() as downloading:
                await page.locator('#exportBtn').click()
            csv_download = await downloading.value
            csv_path = artifacts / csv_download.suggested_filename
            await csv_download.save_as(str(csv_path))
            with csv_path.open(newline='') as handle:
                rows = list(csv.DictReader(handle))
            assert len(rows) == 436, len(rows)
            assert {row['controller'] for row in rows} == {'factory', 'modified'}
            assert {row['scenario'] for row in rows} == {'combined'}
            assert all(math.isfinite(float(row[key])) for row in rows for key in row if key not in ('scenario', 'controller'))
            for controller in ['factory', 'modified']:
                times = [float(row['time_s']) for row in rows if row['controller'] == controller]
                assert times[0] == 0 and times[-1] == 6.5
                assert all(a < b for a, b in zip(times, times[1:]))
            findings['export_csv_rows'] = len(rows)

            await page.locator('[data-panel="results"]').click()
            assert await page.locator('#results').is_visible()
            assert await page.locator('#metricsBody tr').count() == 7
            assert await page.locator('#checksGrid .check').count() == 3
            await page.screenshot(path=str(artifacts / 'results.png'), full_page=True)
            async with page.expect_download() as downloading:
                await page.locator('#exportJsonBtn').click()
            json_download = await downloading.value
            json_path = artifacts / json_download.suggested_filename
            await json_download.save_as(str(json_path))
            report = json.loads(json_path.read_text())
            assert report['schema'] == 'recursivecal-workbench/v0.3'
            assert report['modified_controller_source'] == 'known-fault'
            assert report['controllers']['modified']['parameters']['gain'] == 1.55
            assert len(report['controllers']['factory']['frames']) == 218
            assert report['controllers']['modified']['metrics']['mae_deg'] == findings['scenarios'][-1]['modified']
            findings['export_json'] = 'parameters, full traces, metrics and scope verified'
            await page.locator('[data-panel="workbench"]').click()
            await page.locator('#fullscreenBtn').click()
            assert await page.locator('body').evaluate("el => el.classList.contains('immersive')")
            await page.keyboard.press('Escape')
            assert not await page.locator('body').evaluate("el => el.classList.contains('immersive')")
            await page.locator('#modelInfoBtn').click()
            assert await page.locator('#modelDialog').is_visible()
            await page.locator('#closeModelBtn').click()

            findings['layouts'] = []
            for width, height in [(1536, 1000), (1100, 900), (820, 1000), (390, 844), (360, 800)]:
                await page.set_viewport_size({'width': width, 'height': height})
                await page.locator('#scrubber').evaluate("el => { el.value='3.25'; el.dispatchEvent(new Event('input', {bubbles:true})); }")
                overflow = await page.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth + 2')
                assert not overflow, f'Horizontal overflow at {width}px'
                findings['layouts'].append({'width': width, 'height': height, 'horizontal_overflow': overflow})
                if width == 390:
                    await page.screenshot(path=str(artifacts / 'mobile.png'), full_page=True)
                    await page.locator('#setupToggle').click()
                    assert await page.locator('#faultSelect').is_visible()
                    await page.locator('#faultSelect').select_option('gas_leak')
                    assert await page.locator('#scenarioBadge').inner_text() == 'Gas spring leakage'
                    await page.screenshot(path=str(artifacts / 'mobile-setup.png'), full_page=True)
                    await page.locator('#setupToggle').click()
            assert not errors, errors
            findings['javascript_errors'] = errors
            findings['status'] = 'PASS'
            (artifacts / 'report.json').write_text(json.dumps(findings, indent=2) + '\n')
            print(json.dumps(findings, indent=2))
        except Exception:
            findings['status'] = 'FAIL'
            findings['javascript_errors'] = errors
            (artifacts / 'report.json').write_text(json.dumps(findings, indent=2) + '\n')
            await page.screenshot(path=str(artifacts / 'failure.png'), full_page=True)
            raise
        finally:
            await browser.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('html', type=Path, nargs='?', default=Path(__file__).resolve().parents[1] / 'viewer' / 'RecursiveCal_CAD_Lab.html')
    parser.add_argument('--artifacts', type=Path, default=Path('artifacts/recursivecal-ui'))
    args = parser.parse_args()
    asyncio.run(run(args.html, args.artifacts))
