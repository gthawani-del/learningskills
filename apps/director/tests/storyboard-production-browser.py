import os
"""Local HTTP/Chromium storyboard frames with server-side simulated output.
No main API interception or paid generation; viewport checks are not phone tests.
"""
import json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[3]
out = root / 'test-results'
out.mkdir(exist_ok=True)
server = subprocess.Popen(['node', str(Path(__file__).with_name('storyboard-production-fixture-server.mjs'))], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
try:
    line = server.stdout.readline()
    try:
        info = json.loads(line)
    except Exception:
        raise AssertionError('Storyboard production fixture failed: ' + line + server.stdout.read())
    base = 'http://127.0.0.1:' + str(info['port'])
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'), args=['--no-sandbox', '--disable-dev-shm-usage'])
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        context.add_cookies([{'name': 'director_session', 'value': info['session'], 'url': base, 'httpOnly': True, 'sameSite': 'Strict'}])
        page = context.new_page()
        page.set_default_timeout(15000)
        errors, http, passed, planning_requests = [], [], [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
        page.on('response', lambda response: http.append({'status': response.status, 'url': response.url}) if response.status >= 400 else None)
        page.on('request', lambda request: planning_requests.append(request.url) if '/planning' in request.url else None)
        page.on('dialog', lambda dialog: dialog.accept())
        page.add_init_script("localStorage.setItem('director:lastProject'," + json.dumps(info['projectId']) + ")")
        project_url = base + '/api/projects/' + info['projectId']

        def read(suffix=''):
            response = page.request.get(project_url + suffix)
            assert response.ok, response.text()
            return response.json()

        def summary():
            return read('/storyboard-production')

        def shot(shot_id):
            return next(item for item in summary()['storyboardProductionContext']['shots'] if item['shotId'] == shot_id)

        def open_shot(shot_id):
            row = page.locator('details[data-shot-contract="' + shot_id + '"]')
            if not row.evaluate('node=>node.open'):
                row.locator(':scope > summary').click()
            expect(row).to_have_attribute('open', '')
            assert page.locator('details[data-shot-contract][open]').count() == 1
            return row

        def wait_approved(shot_id, field):
            page.wait_for_function('''async args=>{const response=await fetch(args.url);if(!response.ok)return false;const data=await response.json();return data.storyboardProductionContext.shots.find(item=>item.shotId===args.id)?.[args.field]===true;}''', arg={'url': project_url + '/storyboard-production', 'id': shot_id, 'field': field})

        def approve_direction(shot_id):
            open_shot(shot_id)
            page.locator('[data-frame-direction-ack="' + shot_id + '"]').check()
            page.locator('[data-approve-frame-direction="' + shot_id + '"]').click()
            wait_approved(shot_id, 'directionApproved')
            expect(page.locator('[data-review-frame-cost="' + shot_id + '"]')).to_be_enabled()

        def generate(shot_id, width, height, mobile=False):
            count = len(summary()['jobs'])
            open_shot(shot_id)
            page.locator('[data-review-frame-cost="' + shot_id + '"]').click()
            dialog = page.locator('#storyboard-generation-dialog')
            expect(dialog).to_be_visible()
            expect(page.locator('#storyboard-model')).to_have_value('F-storyboard-frame-local')
            expect(page.locator('#quote-storyboard-generation')).to_be_disabled()
            page.locator('#share-storyboard-references').check()
            page.locator('#quote-storyboard-generation').click()
            expect(page.locator('#authorize-storyboard-generation')).to_be_visible()
            expected_micro = 67500 + 4500 * (shot(shot_id)['referenceCount'] - 1)
            expect(dialog).to_contain_text('$' + format(expected_micro / 1000000, '.4f').rstrip('0').rstrip('.'))
            assert len(summary()['jobs']) == count, 'Quoting must not start frame generation.'
            if page.locator('#storyboard-budget-form').count():
                page.locator('#storyboard-budget-form [name=budget]').fill('0.50')
                page.locator('#storyboard-budget-form button[type=submit]').click()
                expect(page.locator('#storyboard-budget-form')).to_have_count(0)
                assert len(summary()['jobs']) == count
            page.locator('#authorize-storyboard-generation').click()
            expect(page.locator('#run-storyboard-generation')).to_be_enabled()
            assert len(summary()['jobs']) == count, 'Spending authorization must not start frame generation.'
            page.locator('#run-storyboard-generation').click()
            expect(dialog).not_to_be_visible()
            jobs = summary()['jobs']
            assert len(jobs) == count + 1
            job = jobs[-1]
            page.locator('[data-poll-frame-job="' + job['id'] + '"]').click()
            expect(page.locator('[data-import-frame-job="' + job['id'] + '"]')).to_be_visible()
            page.locator('[data-import-frame-job="' + job['id'] + '"]').click()
            candidate_id = None
            page.wait_for_function('''async args=>{const response=await fetch(args.url);const data=await response.json();return data.storyboardProductionContext.shots.find(item=>item.shotId===args.id)?.candidates.some(item=>item.jobId===args.job);}''', arg={'url': project_url + '/storyboard-production', 'id': shot_id, 'job': job['id']})
            candidate = next(item for item in shot(shot_id)['candidates'] if item['jobId'] == job['id'])
            image = page.locator('[data-storyboard-candidate="' + candidate['id'] + '"] img')
            expect(image).to_be_visible()
            expect(image).to_have_js_property('naturalWidth', width)
            expect(image).to_have_js_property('naturalHeight', height)
            assert image.get_attribute('src').startswith('/api/projects/' + info['projectId'] + '/assets/')
            assert not shot(shot_id)['selection']
            image.screenshot(path=str(out / ('storyboard-frame-image-mobile.png' if mobile else 'storyboard-frame-image-desktop.png')))
            if mobile:
                image.scroll_into_view_if_needed()
                page.screenshot(path=str(out / 'storyboard-frame-candidate-mobile.png'))
            else:
                page.locator('[data-storyboard-candidate="' + candidate['id'] + '"]').screenshot(path=str(out / 'storyboard-frame-candidate-desktop.png'))
            return candidate, job

        def select_and_approve(shot_id, candidate, mobile=False):
            page.locator('[data-frame-candidate-review="' + candidate['id'] + '"]').check()
            select = page.locator('[data-select-frame-candidate="' + candidate['id'] + '"]')
            select.scroll_into_view_if_needed()
            if mobile:
                assert select.evaluate('''node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2),footer=document.querySelector('.workspace>.mobile-tools').getBoundingClientRect();return r.top>=0&&r.bottom<=footer.top+.5&&!!hit&&(hit===node||node.contains(hit));}'''), 'Frame Select is hidden by the mobile footer.'
            select.click()
            expect(page.locator('[data-approve-storyboard-frame="' + shot_id + '"]')).to_be_visible()
            assert shot(shot_id)['selectionApproved'] is False
            page.locator('[data-frame-visual-ack="' + shot_id + '"]').check()
            approve = page.locator('[data-approve-storyboard-frame="' + shot_id + '"]')
            approve.scroll_into_view_if_needed()
            if mobile:
                assert approve.evaluate('''node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2),footer=document.querySelector('.workspace>.mobile-tools').getBoundingClientRect();return r.top>=0&&r.bottom<=footer.top+.5&&!!hit&&(hit===node||node.contains(hit));}'''), 'Frame Approve is hidden by the mobile footer.'
                page.screenshot(path=str(out / 'storyboard-frame-mobile-approval.png'))
            approve.click()
            wait_approved(shot_id, 'selectionApproved')

        page.goto(base)
        expect(page.locator('#storyboard-handoff-workspace')).to_be_visible()
        expect(page.locator('#prepare-storyboard-production')).to_be_enabled()
        assert not summary()['jobs']
        assert len(read('/assets')['assets']) == 6
        page.locator('#prepare-storyboard-production').click()
        expect(page.locator('[data-storyboard-frame]')).to_have_count(2)
        expect(page.locator('[data-frame-direction-ack]')).to_have_count(2)
        frames = summary()['storyboardProductionContext']['shots']
        assert all(not item['directionApproved'] and not item['selection'] for item in frames)
        assert frames[0]['referenceCount'] == 5
        assert not summary()['jobs']
        page.screenshot(path=str(out / 'storyboard-frame-overview-desktop.png'), full_page=True)
        passed.append('Approved source references and handoff produce two free frame briefs with exact input pins and proposed pictured characters; no generated frame, selection or paid job is invented')

        first = frames[0]['shotId']
        approve_direction(first)
        candidate, job = generate(first, 1536, 864)
        page.locator('[data-review-frame-cost="' + first + '"]').click()
        expect(page.locator('#storyboard-consumed-quote')).to_be_visible()
        expect(page.locator('#storyboard-correction-required')).to_be_visible()
        expect(page.locator('#quote-storyboard-generation')).to_be_disabled()
        expect(page.locator('#run-storyboard-generation')).to_be_disabled()
        expect(page.locator('#authorize-storyboard-generation')).to_have_count(0)
        assert len(summary()['jobs']) == 1
        page.locator('#close-storyboard-generation').click()
        select_and_approve(first, candidate)
        page.reload()
        expect(page.locator('#storyboard-handoff-workspace')).to_be_visible()
        open_shot(first)
        expect(page.locator('[data-storyboard-candidate="' + candidate['id'] + '"] img')).to_have_js_property('naturalWidth', 1536)
        assert shot(first)['selectionApproved']
        assert all(not item['clipAssetId'] for item in read()['project']['shots'])
        passed.append('Wide frame cost includes five unique inputs, explicit sharing, project cap and spending approval; one Run, original poll and private native-aspect image import lead to separate human selection/approval, and a consumed quote cannot start another attempt')

        page.set_viewport_size({'width': 390, 'height': 844})
        page.reload()
        expect(page.locator('#storyboard-handoff-workspace')).to_be_visible()
        second = frames[1]['shotId']
        open_shot(second)
        page.locator('[data-edit-frame-direction="' + second + '"]').click()
        form = page.locator('#storyboard-frame-editor')
        value = 'Inspect the opening state of this waiting-room shot with the approved identity, look and exact location; keep the settled ending as future context only.'
        form.locator('[name=direction]').fill(value)
        form.locator('[name=aspectRatio]').select_option('9:16')
        before_requests = len(planning_requests)
        page.locator('#project-costs').click()
        expect(page.locator('#spending-dialog')).not_to_be_visible()
        expect(page.locator('#planning-dialog')).not_to_be_visible()
        expect(page.locator('#toast')).to_contain_text('Save or cancel')
        expect(form.locator('[name=direction]')).to_have_value(value)
        expect(form.locator('[name=aspectRatio]')).to_have_value('9:16')
        assert len(planning_requests) == before_requests
        form.locator(':scope > .actions').evaluate('node=>node.scrollIntoView({block:"end",inline:"nearest"})')
        geometry = page.evaluate('''()=>{const footer=document.querySelector('.workspace>.mobile-tools').getBoundingClientRect(),buttons=[...document.querySelectorAll('#storyboard-frame-editor>.actions>button')].map(button=>{const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{text:button.textContent.trim(),top:r.top,bottom:r.bottom,centerHit:!!hit&&(hit===button||button.contains(hit))};});return{width:innerWidth,footerTop:footer.top,buttons,overflow:document.documentElement.scrollWidth>innerWidth};}''')
        assert not geometry['overflow'] and len(geometry['buttons']) == 2, geometry
        for button in geometry['buttons']:
            assert button['top'] >= 0 and button['bottom'] <= geometry['footerTop'] + .5 and button['centerHit'], geometry
        page.screenshot(path=str(out / 'storyboard-frame-mobile-editor-actions.png'))
        form.locator('button[type=submit]').click()
        expect(form).to_have_count(0)
        assert shot(second)['current']['document']['direction'] == value
        assert shot(second)['output']['aspectRatio'] == '9:16'
        assert shot(first)['selectionApproved'] is True
        approve_direction(second)
        portrait, portrait_job = generate(second, 864, 1536, mobile=True)
        select_and_approve(second, portrait, mobile=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        passed.append('390px Chromium preserves unsaved direction/aspect choices, blocks Costs and planning while the edit is dirty, keeps Save/Cancel and real selection/approval actions above the footer and creates a private portrait frame at 864×1536 without cropping the wide frame')

        before = {item['shotId']: item['current'] for item in summary()['storyboardProductionContext']['shots']}
        image_ids = [item['id'] for item in read('/assets')['assets']]
        project = read()['project']
        refs = read('/reference-production')['referenceContext']['subjects']
        identity = next(item for item in refs if item['id'] == 'identity:mira')
        response = page.request.post(project_url + '/approvals', data={'expectedVersion': project['version'], 'artifactId': 'reference_selection:identity:mira', 'version': identity['selection']['version'], 'decision': 'revoked'})
        assert response.ok, response.text()
        page.reload()
        expect(page.locator('#storyboard-handoff-workspace')).to_be_visible()
        held = summary()
        assert all(item['referenceStale'] and not item['directionApproved'] and not item['selectionApproved'] for item in held['storyboardProductionContext']['shots'])
        assert all(item['current'] == before[item['shotId']] for item in held['storyboardProductionContext']['shots'])
        assert [item['id'] for item in read('/assets')['assets']] == image_ids
        open_shot(first)
        expect(page.locator('[data-review-frame-cost="' + first + '"]')).to_be_disabled()
        expect(page.locator('[data-storyboard-candidate="' + candidate['id'] + '"] img')).to_have_js_property('naturalWidth', 1536)
        assert len(held['jobs']) == 2
        passed.append('Revoking the exact identity-selection approval creates real downstream frame holds while every existing direction, candidate image, selection and original job remains available')

        assert not errors, errors
        assert not http, http
        result = {'scope': 'Actual local HTTP APIs/private assets and Chromium, with server-side simulated fal output and no API interception', 'passed': passed, 'consoleErrors': errors, 'httpErrors': http, 'mobileActionGeometry': geometry, 'simulatedProviderJobs': 2, 'realPaidCalls': 0, 'physicalMobileTested': False, 'deployedWebsiteTested': False, 'limitations': ['Synthetic PNG fixtures prove dimensions, storage and user-flow behavior, not model quality, photorealism or provider billing', 'Frames represent still planning evidence; no timed animatic, dialogue delivery, camera motion, voice or finished video is verified', 'No real account isolation, deployed website, physical mobile device or virtual keyboard verification']}
        (out / 'storyboard-production-browser-results.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result))
        browser.close()
finally:
    server.terminate()
    try:
        server.wait(timeout=10)
    except subprocess.TimeoutExpired:
        server.kill()
