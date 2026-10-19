"""Real local HTTP/private asset and Chromium checks; simulated provider only.
No API interception, paid generation, physical phone or deployed account claims.
"""
import json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[3]
out = root / 'test-results'
out.mkdir(exist_ok=True)
server = subprocess.Popen(['node', str(Path(__file__).with_name('reference-fixture-server.mjs'))], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
try:
    line = server.stdout.readline()
    try:
        info = json.loads(line)
    except Exception:
        raise AssertionError('Reference fixture failed: ' + line + server.stdout.read())
    base = 'http://127.0.0.1:' + str(info['port'])
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        context.add_cookies([{'name': 'director_session', 'value': info['session'], 'url': base, 'httpOnly': True, 'sameSite': 'Strict'}])
        page = context.new_page()
        page.set_default_timeout(15000)
        errors, http, passed, requests = [], [], [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
        page.on('response', lambda response: http.append({'status': response.status, 'url': response.url}) if response.status >= 400 else None)
        page.on('request', lambda request: requests.append({'url': request.url, 'method': request.method}) if '/reference-production/' in request.url or '/planning/' in request.url else None)
        page.on('dialog', lambda dialog: dialog.accept())
        page.add_init_script("localStorage.setItem('director:lastProject'," + json.dumps(info['projectId']) + ")")
        project_url = base + '/api/projects/' + info['projectId']

        def read(suffix=''):
            response = page.request.get(project_url + suffix)
            assert response.ok, response.text()
            return response.json()

        def summary():
            return read('/reference-production')

        def subject(subject_id):
            return next(item for item in summary()['referenceContext']['subjects'] if item['id'] == subject_id)

        def open_subject(subject_id):
            row = page.locator('details[data-reference-target="' + subject_id + '"]')
            if not row.evaluate('(node)=>node.open'):
                row.locator(':scope > summary').click()
            expect(row).to_have_attribute('open', '')
            assert page.locator('#reference-production-workspace details[data-reference-target][open]').count() == 1
            return row

        def approve_direction(subject_id):
            open_subject(subject_id)
            page.locator('[data-approve-reference-direction="' + subject_id + '"]').click()
            expect(page.locator('[data-approve-reference-direction="' + subject_id + '"]')).to_have_text('Direction approved')
            assert subject(subject_id)['directionApproved'] is True

        def generate(subject_id, *, mobile=False):
            count = len(summary()['jobs'])
            open_subject(subject_id)
            page.locator('[data-review-reference-cost="' + subject_id + '"]').click()
            dialog = page.locator('#reference-generation-dialog')
            expect(dialog).to_be_visible()
            expect(page.locator('#reference-model')).to_have_value('F-reference-look-local' if subject_id.startswith('look:') else 'F-reference-local')
            if subject_id.startswith('look:'):
                expect(page.locator('#quote-reference-generation')).to_be_disabled()
                page.locator('#share-identity-reference').check()
            page.locator('#quote-reference-generation').click()
            expect(page.locator('#reference-quote-summary')).to_contain_text('$0.025')
            assert len(summary()['jobs']) == count, 'Quoting must not generate an image.'
            if page.locator('#reference-budget-form').count():
                expect(page.locator('#run-reference-generation')).to_be_disabled()
                page.locator('#reference-budget-form [name=budget]').fill('0.20')
                page.locator('#reference-budget-form button[type=submit]').click()
                expect(page.locator('#reference-budget-form')).to_have_count(0)
                assert len(summary()['jobs']) == count, 'Setting a project cap must not generate an image.'
            page.locator('#authorize-reference-generation').click()
            expect(page.locator('#run-reference-generation')).to_be_enabled()
            assert len(summary()['jobs']) == count, 'Authorizing spending must not generate an image.'
            if mobile:
                button = page.locator('#run-reference-generation')
                button.scroll_into_view_if_needed()
                assert button.evaluate('node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.top>=0&&r.bottom<=innerHeight&&!!hit&&(hit===node||node.contains(hit));}'), 'Mobile Generate button must be visible and clickable.'
            page.locator('#run-reference-generation').click()
            expect(dialog).not_to_be_visible()
            jobs = summary()['jobs']
            assert len(jobs) == count + 1
            job = jobs[-1]
            expect(page.locator('[data-poll-reference-job="' + job['id'] + '"]')).to_be_visible()
            page.locator('[data-poll-reference-job="' + job['id'] + '"]').click()
            expect(page.locator('[data-import-reference-job="' + job['id'] + '"]')).to_be_visible()
            assert not subject(subject_id)['selection']
            page.locator('[data-import-reference-job="' + job['id'] + '"]').click()
            expect(page.locator('article[data-reference-candidate] img').last).to_be_visible()
            candidate = next(item for item in subject(subject_id)['candidates'] if item['jobId'] == job['id'])
            image = page.locator('article[data-reference-candidate="' + candidate['id'] + '"] img')
            expect(image).to_be_visible()
            expect(image).to_have_js_property('naturalWidth', 1024)
            expect(image).to_have_js_property('naturalHeight', 1024)
            assert image.get_attribute('src').startswith('/api/projects/' + info['projectId'] + '/assets/')
            assert not subject(subject_id)['selection'], 'Import must not select an image.'
            if subject_id == 'identity:mira' or mobile:
                page.locator('article[data-reference-candidate="' + candidate['id'] + '"]').screenshot(path=str(out / ('reference-candidate-detail-mobile.png' if mobile else 'reference-candidate-detail-desktop.png')))
            return candidate, job

        def select_and_approve(subject_id, candidate, *, mobile=False):
            open_subject(subject_id)
            page.locator('[data-candidate-review="' + candidate['id'] + '"]').check()
            button = page.locator('[data-select-reference-candidate="' + candidate['id'] + '"]')
            button.scroll_into_view_if_needed()
            if mobile:
                assert button.evaluate('node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2),footer=document.querySelector(".workspace>.mobile-tools").getBoundingClientRect();return r.top>=0&&r.bottom<=footer.top+.5&&!!hit&&(hit===node||node.contains(hit));}'), 'Selected image action must be above the footer and reachable.'
            button.click()
            expect(page.locator('[data-approve-reference="' + subject_id + '"]')).to_be_visible()
            assert subject(subject_id)['selectionApproved'] is False
            page.locator('[data-reference-visual-ack="' + subject_id + '"]').check()
            approve = page.locator('[data-approve-reference="' + subject_id + '"]')
            approve.scroll_into_view_if_needed()
            if mobile:
                assert approve.evaluate('node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2),footer=document.querySelector(".workspace>.mobile-tools").getBoundingClientRect();return r.top>=0&&r.bottom<=footer.top+.5&&!!hit&&(hit===node||node.contains(hit));}'), 'Reference approval action must be above the footer and reachable.'
            approve.click()
            expect(page.locator('details[data-reference-target="' + subject_id + '"]')).to_contain_text('This exact reference selection is approved.')
            assert subject(subject_id)['selectionApproved'] is True

        page.goto(base)
        expect(page.locator('#reference-production-workspace')).to_be_visible()
        expect(page.locator('#prepare-reference-production')).to_be_enabled()
        assert not summary()['jobs']
        page.locator('#prepare-reference-production').click()
        expect(page.locator('details[data-reference-target]')).to_have_count(6)
        assert page.locator('#reference-production-workspace textarea').count() == 0
        assert page.locator('#reference-production-workspace details[data-reference-target][open]').count() == 0
        assert all(not item['selection'] and not item['candidates'] for item in summary()['referenceContext']['subjects'])
        assert not read('/assets')['assets'] and not summary()['jobs']
        page.screenshot(path=str(out / 'reference-overview-desktop.png'), full_page=True)
        passed.append('Six compact prefilled identity, look and location directions are prepared from reviewed sources for free, with no blank form wall, generated asset, default selection or job')

        approve_direction('identity:mira')
        identity, identity_job = generate('identity:mira')
        page.screenshot(path=str(out / 'reference-candidate-desktop.png'), full_page=True)
        page.locator('[data-review-reference-cost="identity:mira"]').click()
        expect(page.locator('#reference-generation-dialog')).to_be_visible()
        expect(page.locator('#reference-consumed-quote')).to_be_visible()
        expect(page.locator('#reference-correction-required')).to_be_visible()
        expect(page.locator('#run-reference-generation')).to_be_disabled()
        expect(page.locator('#quote-reference-generation')).to_be_disabled()
        expect(page.locator('#authorize-reference-generation')).to_have_count(0)
        assert len(summary()['jobs']) == 1, 'Reopening a consumed quote must not reserve or submit another job.'
        page.locator('#close-reference-generation').click()
        select_and_approve('identity:mira', identity)
        page.reload()
        expect(page.locator('#reference-production-workspace')).to_be_visible()
        open_subject('identity:mira')
        expect(page.locator('article[data-reference-candidate="' + identity['id'] + '"] img')).to_have_js_property('naturalWidth', 1024)
        assert subject('identity:mira')['selectionApproved'] is True
        passed.append('An explicit estimate, saved project cap, spending authorization and separate Run produce one saved job; private PNG import requires human selection and approval, survives reload, and reopening the consumed quote cannot reuse its permission or request another estimate before diagnosis')

        open_subject('look:mira')
        page.locator('[data-refresh-reference-ack="look:mira"]').check()
        page.locator('[data-refresh-reference="look:mira"]').click()
        expect(page.locator('[data-approve-reference-direction="look:mira"]')).to_be_enabled()
        assert subject('look:mira')['current']['identityBinding']['assetId'] == identity['assetId']
        approve_direction('look:mira')
        look, look_job = generate('look:mira')
        select_and_approve('look:mira', look)
        assert subject('identity:mira')['selectionApproved'] is True
        assert subject('look:mira')['current']['identityBinding']['selectionVersion'] == subject('identity:mira')['selection']['version']
        passed.append('Look generation explicitly binds the approved identity and requires permission before a signed private identity is shared with its selected provider; look approval preserves the identity decision')

        page.set_viewport_size({'width': 390, 'height': 844})
        page.reload()
        expect(page.locator('#reference-production-workspace')).to_be_visible()
        open_subject('location:platform')
        page.locator('[data-edit-reference-direction="location:platform"]').click()
        form = page.locator('#reference-direction-editor')
        value = 'Retain the source platform as an inspectable location reference, with motivated practical light and readable spatial relationships.'
        form.locator('[name=value]').fill(value)
        expect(form.locator('[name=field]')).to_be_disabled()
        before_requests = len(requests)
        page.locator('#project-costs').click()
        page.locator('#open-planning-limits').click()
        expect(page.locator('#planning-dialog')).not_to_be_visible()
        expect(page.locator('#toast')).to_contain_text('Save or cancel')
        expect(form.locator('[name=value]')).to_have_value(value)
        assert len(requests) == before_requests
        if page.locator('#spending-dialog').is_visible():
            page.locator('#close-costs').click()
        form.locator(':scope > .actions').evaluate('node=>node.scrollIntoView({block:"end",inline:"nearest"})')
        geometry = page.evaluate('''()=>{const footer=document.querySelector('.workspace>.mobile-tools').getBoundingClientRect(),buttons=[...document.querySelectorAll('#reference-direction-editor>.actions>button')].map(button=>{const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{text:button.textContent.trim(),top:r.top,bottom:r.bottom,centerHit:!!hit&&(hit===button||button.contains(hit))};});return{width:innerWidth,footerTop:footer.top,buttons,overflow:document.documentElement.scrollWidth>innerWidth};}''')
        assert not geometry['overflow'] and len(geometry['buttons']) == 2, geometry
        for button in geometry['buttons']:
            assert button['top'] >= 0 and button['bottom'] <= geometry['footerTop'] + .5 and button['centerHit'], geometry
        page.screenshot(path=str(out / 'reference-editor-mobile-actions.png'))
        form.locator('button[type=submit]').click()
        expect(form).to_have_count(0)
        assert subject('location:platform')['current']['document']['direction'] == value
        approve_direction('location:platform')
        location, location_job = generate('location:platform', mobile=True)
        select_and_approve('location:platform', location, mobile=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(out / 'reference-approved-mobile.png'))
        passed.append('390px Chromium retains unsaved direction text, blocks a planning shortcut, keeps real Save/Cancel and candidate selection/approval controls above the footer, decodes the private image, and completes mobile-view generation without overflow')

        snapshots = {item['id']: item['current'] for item in summary()['referenceContext']['subjects']}
        image_ids = [item['id'] for item in read('/assets')['assets']]
        project = read()['project']
        camera = next(item for item in read('/department-plans')['departmentContext']['departments'] if item['id'] == 'camera')
        response = page.request.post(project_url + '/department-plans', data={'expectedVersion': project['version'], 'action': 'update', 'departmentId': 'camera', 'document': dict(camera['current']['document'], summary='Review a newly motivated camera direction before generating dependent references.')})
        assert response.ok, response.text()
        page.reload()
        expect(page.locator('#reference-production-workspace')).to_be_visible()
        held = summary()
        assert held['referenceContext']['prerequisites']['departmentsApproved'] is False
        assert all(item['sourceStale'] and not item['selectionApproved'] for item in held['referenceContext']['subjects'])
        assert all(item['current'] == snapshots[item['id']] for item in held['referenceContext']['subjects'])
        assert [item['id'] for item in read('/assets')['assets']] == image_ids
        open_subject('identity:mira')
        expect(page.locator('[data-review-reference-cost="identity:mira"]')).to_be_disabled()
        assert len(held['jobs']) == 3
        passed.append('A real department revision holds all current-source reference approvals and new generation while retaining every historical direction, private image, selection and original job')

        assert not errors, errors
        assert not http, http
        result = {'scope': 'Real local HTTP APIs, authenticated private image reads and Chromium; server-side simulated fal provider, no request interception', 'passed': passed, 'consoleErrors': errors, 'httpErrors': http, 'mobileActionGeometry': geometry, 'simulatedProviderJobs': 3, 'realPaidCalls': 0, 'physicalMobileTested': False, 'deployedWebsiteTested': False, 'limitations': ['Synthetic image fixtures do not validate creative model quality, realistic characters or provider billing', 'No physical phone, virtual keyboard, real account or deployed website verification', 'No storyboard frame generation, animatic, voice or movie export in this module']}
        (out / 'reference-browser-results.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result))
        browser.close()
finally:
    server.terminate()
    try:
        server.wait(timeout=10)
    except subprocess.TimeoutExpired:
        server.kill()
