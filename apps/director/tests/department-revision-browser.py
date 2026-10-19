"""Local real HTTP + Chromium targeted department revision proof.
The provider is a server-side deterministic simulation; no intercepted browser APIs.
390px viewport checks do not verify physical phones or virtual keyboards.
"""
import json, os, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[3]
out = root / 'test-results'
out.mkdir(exist_ok=True)
env = dict(os.environ, DIRECTOR_DEPARTMENT_REVISION_FIXTURE='1')
server = subprocess.Popen(['node', str(Path(__file__).with_name('department-fixture-server.mjs'))], cwd=root, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
try:
    line = server.stdout.readline()
    try:
        info = json.loads(line)
    except Exception:
        raise AssertionError('Department revision fixture failed: ' + line + server.stdout.read())
    base = 'http://127.0.0.1:' + str(info['port'])
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
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
            return read('/department-plans')['departmentContext']
        def unit(unit_id):
            return next(item for item in context()['departments'] if item['id'] == unit_id)
        def planning():
            return read('/planning/revise_departments')
        def open_unit(unit_id):
            row = page.locator('details[data-department-card="' + unit_id + '"]')
            if not row.evaluate('(node)=>node.open'):
                row.locator(':scope > summary').click()
            expect(row).to_have_attribute('open', '')
            assert page.locator('#department-workspace details[data-department-card][open]').count() == 1
            return row
        def open_request(unit_id, instruction):
            open_unit(unit_id)
            page.locator('[data-revise-department="' + unit_id + '"]').click()
            form = page.locator('#department-revision-form')
            expect(form).to_be_visible()
            selected = form.locator('[name=departmentIds]:checked').evaluate_all('nodes=>nodes.map(node=>node.value)')
            assert selected == [unit_id], selected
            form.locator('[name=instruction]').fill(instruction)
            return form

        page.goto(base)
        expect(page.locator('#department-workspace')).to_be_visible()
        initial = context()
        assert all(item['approved'] for item in initial['departments'])
        assert not planning()['calls']
        open_unit('camera')
        page.locator('[data-edit-department=camera]').click()
        editor = page.locator('#department-editor')
        camera_direction = 'Use one motivated lateral move only when the ticket changes hands; preserve the action axis.'
        editor.locator('[name=value]').fill(camera_direction)
        editor.locator('button[type=submit]').click()
        expect(editor).to_have_count(0)
        changed = context()
        affected = sorted(item['id'] for item in changed['departments'] if item['dependencyStale'])
        assert affected == sorted(['lighting', 'continuity', 'storyboard', 'animatic', 'vfx', 'editorial']), affected
        for item in initial['departments']:
            if item['id'] != 'camera':
                assert unit(item['id'])['current'] == item['current']
        assert all(unit(unit_id)['approved'] for unit_id in ['rights', 'voice', 'music'])
        assert not planning()['calls']
        open_unit('lighting')
        expect(page.locator('[data-department-changes=lighting]')).to_contain_text('Camera')
        expect(page.locator('[data-department-changes=lighting]')).to_contain_text('v1')
        expect(page.locator('[data-department-changes=lighting]')).to_contain_text('v2')
        assert page.locator('[data-refresh-department=lighting]').count() == 0
        saved_light = unit('lighting')['current']['document']
        page.locator('[data-review-department-changes=lighting]').click()
        expect(page.locator('#department-status')).to_contain_text('Acknowledge')
        assert unit('lighting')['current']['version'] == 1
        page.locator('[data-department-dependency-ack=lighting]').check()
        page.locator('[data-review-department-changes=lighting]').click()
        expect(page.locator('[data-department-changes=lighting]')).to_have_count(0)
        assert unit('lighting')['current']['version'] == 2 and not unit('lighting')['approved']
        assert unit('lighting')['current']['document'] == saved_light
        assert not unit('camera')['approved'] and unit('rights')['approved']
        page.screenshot(path=str(out / 'department-revision-dependency-review-desktop.png'), full_page=True)
        passed.append('A camera edit versions only Camera, exposes six dependent review holds, preserves approved Rights/Voice/Music and requires explicit acknowledgement to retain Lighting unchanged in a new unapproved version')

        before_request = context()
        instruction = 'Make the camera reveal the waiting ticket through a slow motivated move; preserve the established screen direction and approved script.'
        form = open_request('camera', instruction)
        assert page.locator('#department-workspace textarea').count() == 1
        form.locator('button[type=submit]').click()
        expect(form).to_have_count(0)
        expect(page.locator('#department-saved-revision')).to_contain_text(instruction)
        requested = context()
        assert requested['revision']['valid'] is True and requested['revision']['request']['departmentIds'] == ['camera']
        for item in before_request['departments']:
            assert unit(item['id'])['current'] == item['current']
        assert not planning()['calls']
        page.locator('#run-department-revision').click()
        expect(page.locator('#planning-operation')).to_have_value('revise_departments')
        consent = page.locator('#planning-consent-form')
        expect(consent).to_be_visible()
        consent.locator('[name=max]').fill('0.01')
        consent.locator('[name=finish]').fill('0.0005')
        consent.locator('[name=calls]').fill('3')
        consent.locator('button[type=submit]').click()
        expect(page.locator('[data-planning-call][data-operation=revise_departments]')).to_be_visible()
        assert not planning()['calls']
        passed.append('The focused revision request defaults to Camera only; saving it and approving the separately displayed revision model allowance preserve all department versions and start no model call')

        page.locator('[data-planning-call][data-operation=revise_departments]:enabled').last.click()
        expect(page.locator('[data-poll-planning]')).to_be_visible()
        call = planning()['calls'][-1]
        assert call['operation'] == 'revise_departments'
        page.reload()
        expect(page.locator('#department-workspace')).to_be_visible()
        saved_revision = page.locator('#department-saved-revision > details')
        if not saved_revision.evaluate('(node)=>node.open'):
            saved_revision.locator(':scope > summary').click()
        page.locator('#run-department-revision').click()
        page.locator('[data-poll-planning]').last.click()
        expect(page.locator('[data-review-department-proposal="' + call['id'] + '"]')).to_be_visible()
        page.locator('[data-review-department-proposal="' + call['id'] + '"]').click()
        expect(page.locator('#department-proposal-dialog')).to_be_visible()
        expect(page.locator('#department-proposal-dialog')).to_contain_text('Simulated scoped revision')
        assert page.locator('#department-proposal-dialog [data-department-proposal]').count() == 1
        assert page.locator('#department-proposal-dialog [data-department-proposal=camera]').count() == 1
        assert unit('camera')['current']['version'] == 2
        page.screenshot(path=str(out / 'department-revision-proposal-desktop.png'), full_page=True)
        page.locator('#apply-department-proposal').click()
        expect(page.locator('#department-proposal-dialog')).not_to_be_visible()
        applied = context()
        assert unit('camera')['current']['version'] == 3 and not unit('camera')['approved']
        assert unit('lighting')['current']['version'] == 2 and unit('lighting')['dependencyStale']
        for item in before_request['departments']:
            if item['id'] != 'camera':
                assert unit(item['id'])['current'] == item['current']
        assert all(unit(unit_id)['approved'] for unit_id in ['rights', 'voice', 'music'])
        calls = planning()['calls']
        assert len(calls) == 1 and calls[0]['actualMicroUsd'] == 20 and calls[0]['chargeState'] == 'settled'
        assert applied['revision']['valid'] is False
        passed.append('One queued simulated revision survives reload, records its actual simulated cost, previews only Camera and applies only that snapshot; dependent plans are flagged again without automatic rewrites or paid retries')

        page.set_viewport_size({'width': 390, 'height': 844})
        page.reload()
        expect(page.locator('#department-workspace')).to_be_visible()
        assert page.locator('#department-workspace details[data-department-card][open]').count() == 0
        mobile_instruction = 'Preserve the exact approved lines and use a quieter conversational delivery for the final sentence.'
        form = open_request('voice', mobile_instruction)
        form.locator('.department-revision-targets > summary').click()
        expect(form.locator('[name=departmentIds][value=voice]')).to_be_checked()
        assert form.locator('[name=departmentIds]:checked').count() == 1
        assert page.locator('#department-workspace textarea').count() == 1
        requests_before_guard = len(planning_requests)
        page.locator('#project-costs').click()
        expect(page.locator('#spending-dialog')).to_be_visible()
        page.locator('#open-planning-limits').click()
        expect(page.locator('#spending-dialog')).not_to_be_visible()
        expect(page.locator('#planning-dialog')).not_to_be_visible()
        expect(page.locator('#toast')).to_contain_text('Save or cancel your department edit')
        expect(form.locator('[name=instruction]')).to_have_value(mobile_instruction)
        expect(form.locator('[name=departmentIds][value=voice]')).to_be_checked()
        assert form.locator('[name=departmentIds]:checked').count() == 1
        assert len(planning_requests) == requests_before_guard, planning_requests
        assert len(read()['project']['departmentPlanning']['revisionRequests']) == 1
        unsaved_guard = {'planningRequestsBefore': requests_before_guard, 'planningRequestsAfter': len(planning_requests), 'instructionRetained': True, 'selectedDepartmentIds': ['voice'], 'planningDialogOpened': False, 'newRevisionRequestSaved': False}
        geometry = page.evaluate('''()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}};return {width:innerWidth,height:innerHeight,form:rect('#department-revision-form'),workspace:rect('#department-workspace'),openUnits:document.querySelectorAll('#department-workspace details[data-department-card][open]').length,overflow:document.documentElement.scrollWidth>innerWidth};}''')
        assert not geometry['overflow'] and geometry['openUnits'] == 1, geometry
        assert geometry['form']['left'] >= -1 and geometry['form']['right'] <= 391, geometry
        page.screenshot(path=str(out / 'department-revision-mobile-viewport.png'), full_page=True)
        form.locator(':scope > .actions').evaluate('(node)=>node.scrollIntoView({block:"end",inline:"nearest"})')
        action_geometry = page.evaluate('''()=>{const footer=document.querySelector('.workspace > .mobile-tools').getBoundingClientRect();const buttons=[...document.querySelectorAll('#department-revision-form > .actions > button')].map(button=>{const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {text:button.textContent.trim(),top:r.top,bottom:r.bottom,left:r.left,right:r.right,centerHit:!!hit&&(button===hit||button.contains(hit))};});return{width:innerWidth,height:innerHeight,footerTop:footer.top,buttons};}''')
        assert len(action_geometry['buttons']) == 2, action_geometry
        for button in action_geometry['buttons']:
            assert button['top'] >= 0 and button['bottom'] <= action_geometry['footerTop'] + .5, action_geometry
            assert button['left'] >= -1 and button['right'] <= action_geometry['width'] + 1, action_geometry
            assert button['centerHit'], action_geometry
        page.screenshot(path=str(out / 'department-revision-mobile-actions.png'))
        form.locator('button[type=submit]').click()
        expect(form).to_have_count(0)
        assert context()['revision']['request']['departmentIds'] == ['voice']
        assert len(read()['project']['departmentPlanning']['revisionRequests']) == 2
        assert len(planning()['calls']) == 1
        passed.append('390px Chromium viewport retains the unsaved instruction and Voice-only scope when Costs → Planning limits is blocked without a planning API request or modal; one focused editor has no overflow, Save/Cancel scroll above the fixed footer and pass center hit checks; actual Save records a second free request without another model call')

        assert not errors, errors
        assert not http, http
        result = {'scope': 'Actual local HTTP APIs and Chromium with a server-side simulated provider; no browser request interception', 'passed': passed, 'consoleErrors': errors, 'httpErrors': http, 'mobileGeometry': geometry, 'mobileActionGeometry': action_geometry, 'unsavedPlanningGuard': unsaved_guard, 'simulatedRevisionCalls': 1, 'realPaidCalls': 0, 'physicalMobileTested': False, 'deployedWebsiteTested': False, 'limitations': ['No real OpenAI revision-quality evaluation', 'No physical mobile device or virtual keyboard', 'No deployed account or live billing verification', 'Department plans and review holds are not generated-media or final-film quality evidence']}
        (out / 'department-revision-browser-results.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result))
        browser.close()
finally:
    server.terminate()
    try:
        server.wait(timeout=4)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait()
