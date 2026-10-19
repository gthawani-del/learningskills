import os
"""Actual local HTTP/API + Chromium storyboard-handoff planning checks.
Provider responses are deterministic server-side simulations, without interception.
Mobile viewports do not verify physical phones or virtual keyboards.
"""
import json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[3]
out = root / 'test-results'
out.mkdir(exist_ok=True)
server = subprocess.Popen(['node', str(Path(__file__).with_name('storyboard-fixture-server.mjs'))], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
try:
    line = server.stdout.readline()
    try:
        info = json.loads(line)
    except Exception:
        raise AssertionError('Storyboard fixture failed: ' + line + server.stdout.read())
    base = 'http://127.0.0.1:' + str(info['port'])
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'), args=['--no-sandbox', '--disable-dev-shm-usage'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.set_default_timeout(15000)
        errors, http, passed, planning_requests = [], [], [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
        page.on('response', lambda response: http.append({'status': response.status, 'url': response.url}) if response.status >= 400 else None)
        page.on('request', lambda request: planning_requests.append({'method': request.method, 'url': request.url}) if '/planning' in request.url else None)
        page.on('dialog', lambda dialog: dialog.accept())
        page.add_init_script("localStorage.setItem('director:lastProject'," + json.dumps(info['projectId']) + ")")
        project_url = base + '/api/projects/' + info['projectId']
        def read(suffix=''):
            response = page.request.get(project_url + suffix)
            assert response.ok, response.text()
            return response.json()
        def context():
            return read('/storyboard-handoff')['storyboardContext']
        def planning():
            return read('/planning/plan_storyboard')
        def shot(shot_id):
            return next(item for item in context()['shots'] if item['id'] == shot_id)
        def order():
            return [item['shotId'] for item in context()['sequence']['current']['shots']]
        def open_shot(shot_id):
            row = page.locator('details[data-shot-contract="' + shot_id + '"]')
            if not row.evaluate('(node)=>node.open'):
                row.locator(':scope > summary').click()
            expect(row).to_have_attribute('open', '')
            assert page.locator('#storyboard-handoff-workspace details[data-shot-contract][open]').count() == 1
            return row
        def edit_title(shot_id, value):
            open_shot(shot_id)
            page.locator('[data-edit-shot-contract="' + shot_id + '"]').click()
            form = page.locator('#shot-contract-editor')
            expect(form).to_be_visible()
            form.locator('[name=field]').select_option('title')
            form.locator('[name=value]').fill(value)
            form.locator('button[type=submit]').click()
            expect(form).to_have_count(0)
        def approve_plan():
            page.locator('#storyboard-planning-only-ack').check()
            page.locator('#approve-storyboard-handoff').click()
            expect(page.locator('#approve-storyboard-handoff')).to_have_text('Handoff plan approved')
            expect(page.locator('#approve-storyboard-handoff')).to_be_disabled()
            assert context()['sequence']['approved'] is True

        page.goto(base)
        expect(page.locator('#storyboard-handoff-workspace')).to_be_visible()
        assert not context()['shots'] and not planning()['calls']
        page.locator('#prepare-storyboard-handoff').click()
        expect(page.locator('details[data-shot-contract]').first).to_be_visible()
        initial = context()
        assert initial['sequence']['coverage']['complete'] is True
        assert all(not item['approved'] for item in initial['shots'])
        assert not planning()['calls']
        assert page.locator('#storyboard-handoff-workspace textarea').count() == 0
        assert page.locator('#storyboard-handoff-workspace details[data-shot-contract][open]').count() == 0
        assert not read('/assets')['assets']
        page.screenshot(path=str(out / 'storyboard-handoff-overview-desktop.png'), full_page=True)
        approve_plan()
        assert all(item['approved'] for item in context()['shots'])
        passed.append('Approved screenplay and all seventeen department plans produce complete source-linked shot contracts for free; compact collapsed rows start with no text boxes, media or model calls, and one explicit planning-only approval reviews the whole sequence')

        first = initial['shots'][0]['id']
        others = {item['id']: item['current'] for item in context()['shots'] if item['id'] != first}
        edit_title(first, 'The ticket passes between two waiting travellers')
        changed = context()
        assert shot(first)['current']['version'] == 2 and not shot(first)['approved']
        assert changed['sequence']['stale'] is True and changed['sequence']['approved'] is False
        for shot_id, previous in others.items():
            assert shot(shot_id)['current'] == previous and shot(shot_id)['approved']
        page.locator('#storyboard-sequence-change-ack').check()
        page.locator('#review-storyboard-sequence').click()
        expect(page.locator('#storyboard-sequence-change-ack')).to_have_count(0)
        assert context()['sequence']['stale'] is False
        approve_plan()
        prior_order = order()
        open_shot(prior_order[0])
        page.locator('[data-move-shot-down="' + prior_order[0] + '"]').click()
        new_order = [prior_order[1], prior_order[0], *prior_order[2:]]
        expect(page.locator('details[data-shot-contract]').first).to_have_attribute('data-shot-contract', new_order[0])
        assert order() == new_order
        page.reload()
        expect(page.locator('#storyboard-handoff-workspace')).to_be_visible()
        assert order() == new_order
        assert page.locator('details[data-shot-contract]').evaluate_all('nodes=>nodes.map(node=>node.dataset.shotContract)') == new_order
        assert all(item['approved'] for item in context()['shots'])
        passed.append('A focused edit versions one contract, preserves neighboring approvals and explicitly updates sequence pins; accessible reordering changes order only and survives reload')

        edit_title(first, 'A draft title awaiting an AI coverage proposal')
        before_ai = context()
        page.locator('#ai-storyboard').click()
        expect(page.locator('#planning-operation')).to_have_value('plan_storyboard')
        consent = page.locator('#planning-consent-form')
        expect(consent).to_be_visible()
        consent.locator('[name=max]').fill('0.01')
        consent.locator('[name=finish]').fill('0.0005')
        consent.locator('[name=calls]').fill('3')
        consent.locator('button[type=submit]').click()
        expect(page.locator('[data-planning-call][data-operation=plan_storyboard]')).to_be_visible()
        assert not planning()['calls']
        page.locator('[data-planning-call][data-operation=plan_storyboard]:enabled').last.click()
        expect(page.locator('[data-poll-planning]')).to_be_visible()
        page.locator('[data-poll-planning]').last.click()
        call = planning()['calls'][-1]
        expect(page.locator('[data-review-storyboard-proposal="' + call['id'] + '"]')).to_be_visible()
        page.locator('[data-review-storyboard-proposal="' + call['id'] + '"]').click()
        expect(page.locator('#storyboard-proposal-dialog')).to_be_visible()
        expect(page.locator('#storyboard-proposal-dialog')).to_contain_text('simulated coverage revision')
        assert shot(first)['current']['version'] == 3
        page.screenshot(path=str(out / 'storyboard-handoff-proposal-desktop.png'), full_page=True)
        page.locator('#apply-storyboard-proposal').click()
        expect(page.locator('#storyboard-proposal-dialog')).not_to_be_visible()
        assert shot(first)['current']['version'] == 4 and not shot(first)['approved']
        for item in before_ai['shots']:
            if item['id'] != first:
                assert shot(item['id'])['current'] == item['current'] and shot(item['id'])['approved']
        assert order() == new_order
        calls = planning()['calls']
        assert len(calls) == 1 and calls[0]['actualMicroUsd'] == 20 and calls[0]['chargeState'] == 'settled'
        passed.append('Storyboard planning has its own reviewed model and allowance; explicit submission, saved simulated usage, read-only proposal review and Apply preserve existing order and approved neighboring contracts without generating frames or retrying automatically')

        page.set_viewport_size({'width': 390, 'height': 844})
        page.reload()
        expect(page.locator('#storyboard-handoff-workspace')).to_be_visible()
        open_shot(first)
        page.locator('[data-edit-shot-contract="' + first + '"]').click()
        form = page.locator('#shot-contract-editor')
        mobile_value = 'Keep the audience attentive to the small, deliberate exchange of the ticket.'
        form.locator('[name=field]').select_option('purpose')
        form.locator('[name=value]').fill(mobile_value)
        expect(form.locator('[name=field]')).to_be_disabled()
        requests_before = len(planning_requests)
        page.locator('#project-costs').click()
        page.locator('#open-planning-limits').click()
        expect(page.locator('#planning-dialog')).not_to_be_visible()
        expect(page.locator('#spending-dialog')).not_to_be_visible()
        expect(page.locator('#toast')).to_contain_text('Save or cancel')
        expect(form.locator('[name=value]')).to_have_value(mobile_value)
        assert len(planning_requests) == requests_before
        form.locator(':scope > .actions').evaluate('(node)=>node.scrollIntoView({block:"end",inline:"nearest"})')
        geometry = page.evaluate('''()=>{const footer=document.querySelector('.workspace>.mobile-tools').getBoundingClientRect(),form=document.querySelector('#shot-contract-editor').getBoundingClientRect(),buttons=[...document.querySelectorAll('#shot-contract-editor>.actions>button')].map(button=>{const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{text:button.textContent.trim(),left:r.left,right:r.right,top:r.top,bottom:r.bottom,centerHit:!!hit&&(button===hit||button.contains(hit))};});return{width:innerWidth,height:innerHeight,footerTop:footer.top,formLeft:form.left,formRight:form.right,buttons,overflow:document.documentElement.scrollWidth>innerWidth};}''')
        assert not geometry['overflow'] and geometry['formLeft'] >= -1 and geometry['formRight'] <= 391, geometry
        assert len(geometry['buttons']) == 2, geometry
        for button in geometry['buttons']:
            assert button['top'] >= 0 and button['bottom'] <= geometry['footerTop'] + .5 and button['centerHit'], geometry
        page.screenshot(path=str(out / 'storyboard-handoff-mobile-actions.png'))
        version = shot(first)['current']['version']
        form.locator('button[type=submit]').click()
        expect(form).to_have_count(0)
        assert shot(first)['current']['version'] == version + 1
        assert shot(first)['current']['document']['purpose'] == mobile_value
        assert len(planning()['calls']) == 1
        passed.append('390px Chromium keeps one focused prefilled editor, blocks Costs → Planning while text is unsaved, preserves that draft, has no horizontal overflow and keeps actual clickable Save/Cancel controls above the footer')

        before_hold = context()
        project = read()['project']
        departments = read('/department-plans')['departmentContext']
        camera = next(item for item in departments['departments'] if item['id'] == 'camera')
        response = page.request.post(project_url + '/department-plans', data={'expectedVersion': project['version'], 'action': 'update', 'departmentId': 'camera', 'document': dict(camera['current']['document'], summary='Review a new camera direction before generating any dependent storyboard frames.')})
        assert response.ok, response.text()
        page.reload()
        expect(page.locator('#storyboard-handoff-workspace')).to_be_visible()
        held = context()
        assert held['prerequisites']['departmentsApproved'] is False
        assert all(item['sourceStale'] and not item['approved'] for item in held['shots'])
        for item in before_hold['shots']:
            assert shot(item['id'])['current'] == item['current']
        expect(page.locator('#approve-storyboard-handoff')).to_be_disabled()
        assert len(planning()['calls']) == 1
        passed.append('An actual API department revision creates visible downstream source holds after reload while preserving every saved contract, its order and existing paid call')

        assert not errors, errors
        assert not http, http
        result = {'scope': 'Actual local HTTP APIs and Chromium with a server-side simulated provider; no browser request interception', 'passed': passed, 'consoleErrors': errors, 'httpErrors': http, 'mobileActionGeometry': geometry, 'simulatedStoryboardCalls': 1, 'realPaidCalls': 0, 'physicalMobileTested': False, 'deployedWebsiteTested': False, 'limitations': ['No generated storyboard images or playable animatic', 'No real OpenAI quality or billing evaluation', 'No physical mobile device or virtual keyboard', 'No deployed-account verification; existing media editing/playback regressions are separate checks']}
        (out / 'storyboard-browser-results.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result))
        browser.close()
finally:
    server.terminate()
    try:
        server.wait(timeout=4)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait()
