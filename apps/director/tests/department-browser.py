"""Actual local Chromium + API interactions, with server-side simulated AI only.
Mobile viewport coverage is not physical-device or virtual-keyboard verification.
"""
import json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[3]
out = root / 'test-results'
out.mkdir(exist_ok=True)
server = subprocess.Popen(['node', str(Path(__file__).with_name('department-fixture-server.mjs'))], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
try:
    line = server.stdout.readline()
    try:
        info = json.loads(line)
    except Exception:
        raise AssertionError('Department fixture failed to start: ' + line + server.stdout.read())
    base = 'http://127.0.0.1:' + str(info['port'])
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.set_default_timeout(15000)
        errors, http, passed = [], [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
        page.on('response', lambda response: http.append({'status': response.status, 'url': response.url}) if response.status >= 400 else None)
        page.on('dialog', lambda dialog: dialog.accept())
        page.add_init_script("localStorage.setItem('director:lastProject'," + json.dumps(info['projectId']) + ")")
        project_url = base + '/api/projects/' + info['projectId']
        def read(suffix=''):
            response = page.request.get(project_url + suffix)
            assert response.ok, response.text()
            return response.json()
        def context():
            return read('/department-plans')['departmentContext']
        def unit(unit_id):
            return next(item for item in context()['departments'] if item['id'] == unit_id)
        def planning():
            return read('/planning/plan_departments')
        def open_unit(unit_id):
            row = page.locator('details[data-department-card="' + unit_id + '"]')
            expect(row).to_have_count(1)
            if not row.evaluate('(node)=>node.open'):
                row.locator(':scope > summary').click()
            expect(row).to_have_attribute('open', '')
            assert page.locator('#department-workspace details[data-department-card][open]').count() == 1
            return row
        def approve(unit_id):
            open_unit(unit_id)
            page.locator('[data-department-ack="' + unit_id + '"]').check()
            page.locator('[data-approve-department="' + unit_id + '"]').click()
            expect(page.locator('[data-approve-department="' + unit_id + '"]')).to_have_text('Plan approved')

        page.goto(base)
        expect(page.locator('#department-workspace')).to_be_visible()
        assert not any(item['current'] for item in context()['departments'])
        assert not planning()['calls']
        page.locator('#prepare-departments').click()
        expect(page.locator('details[data-department-card=camera]')).to_be_visible()
        assert len(context()['departments']) == 17
        assert all(item['current'] and not item['approved'] for item in context()['departments'])
        assert not planning()['calls']
        expect(page.locator('#department-workspace')).to_contain_text('Plan approval does not select or approve actors, images, voices or generated media')
        assert page.locator('#department-workspace details[data-department-card][open]').count() == 0
        assert page.locator('#department-workspace textarea').count() == 0
        for unit_id in ['casting', 'look', 'voice', 'storyboard', 'animatic']:
            expect(page.locator('[data-department-card="' + unit_id + '"]')).to_contain_text('Needs review')
        page.screenshot(path=str(out / 'departments-overview-desktop.png'), full_page=True)
        passed.append('Approved script prepares all seventeen department plans for free in a collapsed overview, including casting, look, voice, storyboard and animatic; no model calls or default text-box wall')

        open_unit('camera')
        page.locator('[data-approve-department=camera]').click()
        expect(page.locator('#department-status')).to_contain_text('plan only')
        assert not unit('camera')['approved']
        approve('camera')
        approve('rights')
        assert unit('camera')['approved'] and unit('rights')['approved']
        original = context()
        open_unit('camera')
        page.locator('[data-edit-department=camera]').click()
        editor = page.locator('#department-editor')
        expect(editor).to_be_visible()
        assert page.locator('#department-workspace textarea').count() == 1
        correction = 'Use an eye-level locked frame for the ticket handoff; retain the established screen direction.'
        editor.locator('[name=value]').fill(correction)
        expect(editor.locator('[name=field]')).to_be_disabled()
        page.locator('#rail [data-stage=story]').click()
        expect(page.locator('#department-workspace')).to_be_visible()
        expect(editor.locator('[name=value]')).to_have_value(correction)
        expect(page.locator('#toast')).to_contain_text('Save or cancel')
        editor.locator('button[type=submit]').click()
        expect(page.locator('#department-editor')).to_have_count(0)
        assert unit('camera')['current']['version'] == 2 and not unit('camera')['approved']
        assert unit('rights')['approved']
        for item in original['departments']:
            if item['id'] != 'camera':
                assert unit(item['id'])['current'] == item['current']
        passed.append('Planning-only acknowledgement is required; one focused edit blocks accidental navigation, versions only Camera and preserves Rights approval and other department documents')

        open_unit('casting')
        page.locator('[data-edit-department=casting]').click()
        editor = page.locator('#department-editor')
        choice_options = editor.locator('[name=field] option').evaluate_all("nodes => nodes.filter(n=>n.value.startsWith('choices.')).map(n=>n.value)")
        assert choice_options, 'Casting must expose a reviewable candidate choice'
        editor.locator('[name=field]').select_option(choice_options[0])
        editor = page.locator('#department-editor')
        editor.locator('[name=value]').fill('A calm, observant performance; review actual actor references before selecting a performer.')
        editor.locator('[name=recordChoice]').check()
        editor.locator('button[type=submit]').click()
        expect(page.locator('#department-editor')).to_have_count(0)
        selected = [choice for choice in unit('casting')['current']['document']['choices'] if choice['status'] == 'user_selected']
        assert len(selected) == 1 and not unit('casting')['approved']
        assert context()['assetsApproved'] is False and context()['generationAuthorized'] is False
        page.reload()
        expect(page.locator('#department-workspace')).to_be_visible()
        assert unit('camera')['current']['document']['summary'] == correction and unit('rights')['approved']
        passed.append('An explicit creative choice survives reload, remains separate from performer/media approval and does not authorize generation')

        page.locator('#ai-departments').click()
        expect(page.locator('#planning-operation')).to_have_value('plan_departments')
        form = page.locator('#planning-consent-form')
        expect(form).to_be_visible()
        form.locator('[name=max]').fill('0.01')
        form.locator('[name=finish]').fill('0.0005')
        form.locator('[name=calls]').fill('3')
        form.locator('button[type=submit]').click()
        expect(page.locator('[data-planning-call][data-operation=plan_departments]').last).to_be_visible()
        assert not planning()['calls']
        page.locator('[data-planning-call][data-operation=plan_departments]:enabled').last.click()
        expect(page.locator('[data-poll-planning]')).to_be_visible()
        page.locator('[data-poll-planning]').last.click()
        call = planning()['calls'][-1]
        expect(page.locator('[data-review-department-proposal="' + call['id'] + '"]')).to_be_visible()
        page.locator('[data-review-department-proposal="' + call['id'] + '"]').click()
        expect(page.locator('#department-proposal-dialog')).to_be_visible()
        expect(page.locator('#department-proposal-dialog')).to_contain_text('Simulated proposal')
        assert unit('sound')['current']['version'] == 1
        page.screenshot(path=str(out / 'departments-proposal-desktop.png'), full_page=True)
        page.locator('#apply-department-proposal').click()
        expect(page.locator('#department-proposal-dialog')).not_to_be_visible()
        assert unit('sound')['current']['version'] == 2 and not unit('sound')['approved']
        assert unit('rights')['approved']
        assert any(choice == selected[0] for choice in unit('casting')['current']['document']['choices'])
        assert len(planning()['calls']) == 1 and planning()['calls'][0]['actualMicroUsd'] == 20
        passed.append('Department AI has its own displayed operation allowance, never runs on consent alone, persists a queued simulated call and applies only after review while preserving approved plans and user choices')

        page.set_viewport_size({'width': 390, 'height': 844})
        page.reload()
        expect(page.locator('#department-workspace')).to_be_visible()
        assert page.locator('#department-workspace details[data-department-card][open]').count() == 0
        overview = page.evaluate('''()=>{const work=document.querySelector('#department-workspace').getBoundingClientRect();const rows=[...document.querySelectorAll('#department-workspace details[data-department-card]')].map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.departmentCard,height:r.height}});return {width:innerWidth,height:innerHeight,workspaceHeight:work.height,rows,openCount:document.querySelectorAll('#department-workspace details[data-department-card][open]').length};}''')
        assert len(overview['rows']) == 17 and overview['openCount'] == 0, overview
        assert max(row['height'] for row in overview['rows']) <= 120, overview
        assert overview['workspaceHeight'] <= 2000, overview
        page.screenshot(path=str(out / 'departments-mobile-overview.png'), full_page=True)
        open_unit('voice')
        page.locator('[data-edit-department=voice]').click()
        editor = page.locator('#department-editor')
        expect(editor).to_be_visible()
        editor.locator('[name=value]').fill('A quiet, conversational voice; listen to actual voice samples before approving the performance.')
        editor.locator('button[type=submit]').click()
        expect(editor).to_have_count(0)
        assert unit('voice')['current']['version'] == 2
        assert page.locator('#department-workspace details[data-department-card][open]').count() == 1
        geometry = page.evaluate('''()=>{const r=document.querySelector('#department-workspace').getBoundingClientRect();const cards=[...document.querySelectorAll('[data-department-card]')].map(e=>{const a=e.getBoundingClientRect();return{left:a.left,right:a.right}});return{width:innerWidth,height:innerHeight,left:r.left,right:r.right,cards,overflow:document.documentElement.scrollWidth>innerWidth};}''')
        assert not geometry['overflow'] and geometry['left'] >= -1 and geometry['right'] <= geometry['width'] + 1, geometry
        assert all(card['left'] >= -1 and card['right'] <= geometry['width'] + 1 for card in geometry['cards']), geometry
        page.screenshot(path=str(out / 'departments-mobile-viewport.png'), full_page=True)
        passed.append('390px Chromium viewport shows seventeen compact collapsed rows within a bounded overview; opening one closes the others, focused editing works without horizontal overflow; physical mobile and virtual keyboards remain untested')

        assert not errors, errors
        assert not http, http
        result = {'scope': 'Actual local HTTP APIs, LocalStore and Chromium; deterministic server-side simulated OpenAI responses; no browser request interception', 'passed': passed, 'consoleErrors': errors, 'httpErrors': http, 'geometry': geometry, 'mobileOverview': overview, 'simulatedDepartmentCalls': 1, 'realPaidCalls': 0, 'physicalMobileTested': False, 'deployedWebsiteTested': False, 'limitations': ['No real model-output or filmmaking-quality evaluation', 'No paid OpenAI or fal calls', 'No physical mobile device or virtual keyboard', 'No deployed account/isolation testing', 'Plans are not generated characters, voice samples, storyboards, animatics or finished films']}
        (out / 'department-browser-results.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result))
        browser.close()
finally:
    server.terminate()
    try:
        server.wait(timeout=4)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait()
