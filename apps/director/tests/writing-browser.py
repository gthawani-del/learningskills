"""Real local HTTP API + Chromium writing flows; server-side simulated provider only.
Desktop mobile viewports are not physical mobile-device or virtual-keyboard tests.
"""
import json, os, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
root = Path(__file__).resolve().parents[3]
out = root / 'test-results'
out.mkdir(exist_ok=True)
stage_failure = os.environ.get('DIRECTOR_WRITING_STAGE_FAILURE') == '1'
server = subprocess.Popen(['node', str(Path(__file__).with_name('writing-fixture-server.mjs'))], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
try:
    line = server.stdout.readline()
    try:
        info = json.loads(line)
    except Exception:
        raise AssertionError('Writing fixture failed to start: ' + line + server.stdout.read())
    base = 'http://127.0.0.1:' + str(info['port'])
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('DIRECTOR_CHROMIUM_PATH','/usr/bin/chromium'), args=['--no-sandbox', '--disable-dev-shm-usage'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.set_default_timeout(15000)
        errors, http, passed, geometries = [], [], [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('response', lambda r: http.append({'status': r.status, 'url': r.url}) if r.status >= 400 else None)
        page.on('dialog', lambda dialog: dialog.accept())
        page.add_init_script("localStorage.setItem('director:lastProject'," + json.dumps(info['projectId']) + ")")
        project_url = base + '/api/projects/' + info['projectId']
        initial_project_url = project_url
        def project():
            response = page.request.get(project_url)
            assert response.ok, response.text()
            return response.json()['project']
        def planning():
            response = page.request.get(project_url + '/planning')
            assert response.ok, response.text()
            return response.json()
        def screenplay():
            response = page.request.get(project_url + '/screenplay')
            assert response.ok, response.text()
            return response.json()['screenplayContext']
        def approve_direction():
            expect(page.locator('#compact-brief')).to_be_visible()
            if page.locator('#approve-direction').count():
                page.locator('#approve-direction').click()
            page.locator('#continue-direction').click()
            expect(page.locator('#screenplay-workspace')).to_be_visible()
        def planning_limit(operation='write_script'):
            page.locator('#write-script').click()
            page.locator('#planning-operation').select_option(operation)
            form = page.locator('#planning-consent-form')
            expect(form).to_be_visible()
            form.locator('[name=max]').fill('0.005')
            form.locator('[name=finish]').fill('0.0005')
            form.locator('[name=calls]').fill('3')
            form.locator('button[type=submit]').click()
            expect(page.locator('[data-planning-call][data-operation="' + operation + '"]').last).to_be_visible()
        def review_completed(operation):
            page.locator('[data-poll-planning]').last.click()
            call = [c for c in planning()['calls'] if c['operation'] == operation][-1]
            expect(page.locator('[data-review-screenplay-proposal="' + call['id'] + '"]')).to_be_visible()
            page.locator('[data-review-screenplay-proposal="' + call['id'] + '"]').click()
            expect(page.locator('#screenplay-proposal-dialog')).to_be_visible()
            return call
        page.goto(base)
        approve_direction()
        expect(page.locator('#screenplay-workspace')).to_contain_text('Uploading a script is optional')
        assert screenplay()['screenplay'] is None
        assert not planning()['calls']
        planning_limit()
        assert not planning()['calls']
        passed.append('Original writing is the default; neither viewing the workspace nor approving a limit starts a model call')
        page.locator('[data-operation=write_script]').last.click()
        expect(page.locator('[data-poll-planning]')).to_be_visible()
        assert screenplay()['screenplay'] is None
        page.reload()
        expect(page.locator('#screenplay-workspace')).to_be_visible()
        if stage_failure:
            page.locator('#rail [data-stage=cast]').click()
            page.locator('#project-costs').click()
            page.locator('#open-planning-limits').click()
        else:
            page.locator('#write-script').click()
        call = review_completed('write_script')
        expect(page.locator('#screenplay-proposal-dialog')).to_contain_text('Then I will leave the light on.')
        assert screenplay()['screenplay'] is None
        page.screenshot(path=str(out / 'writing-proposal-desktop.png'), full_page=True)
        page.locator('#apply-screenplay-proposal').click()
        expect(page.locator('#screenplay-proposal-dialog')).not_to_be_visible()
        if stage_failure:
            expect(page.locator('#toast')).to_contain_text('Script saved. Could not open Story.')
            assert screenplay()['currentVersion'] == 1 and project()['stage'] == 'cast'
            expect(page.locator('#apply-screenplay-proposal')).not_to_be_visible()
            expect(page.locator('#screenplay-proposal-dialog')).not_to_be_visible()
            page.locator('#rail [data-stage=story]').click()
            expect(page.locator('#screenplay-workspace')).to_be_visible()
            assert screenplay()['currentVersion'] == 1 and len(planning()['calls']) == 1
            passed.append('Controlled store failure after successful script apply closes the proposal, retains saved script once and recovers through manual Story navigation without a paid retry')
        context = screenplay()
        assert context['currentVersion'] == 1 and context['approved'] is False
        assert context['screenplay']['provenance']['kind'] == 'llm_generated'
        assert context['originality']['status'] == 'coverage_unavailable'
        assert len(planning()['calls']) == 1 and planning()['calls'][0]['actualMicroUsd'] == 20
        passed.append('Saved queued call survives reload; review is read-only; explicit apply creates an unapproved version with model-call provenance and accounted simulated usage')
        expect(page.locator('.script-originality')).to_contain_text('Comparison coverage unavailable')
        expect(page.locator('.script-originality')).to_contain_text('External scripts, translated copying and plot similarity are not checked')
        page.locator('#approve-screenplay').click()
        expect(page.locator('#screenplay-status')).to_contain_text('Acknowledge')
        assert screenplay()['approved'] is False
        page.locator('#screenplay-coverage-ack').check()
        page.locator('#approve-screenplay').click()
        expect(page.locator('#approve-screenplay')).to_have_text('Script approved')
        assert screenplay()['approved'] is True
        passed.append('Coverage limitations are visible and explicit acknowledgement is required before script approval')
        original = screenplay()['screenplay']['document']
        page.locator('#revise-screenplay').click()
        form = page.locator('#screenplay-revision-form')
        form.locator('[name=instruction]').fill('Have Rafi help with the noticeboard in the opening scene.')
        form.locator('[name=sceneIds][value=platform]').check()
        form.locator('button[type=submit]').click()
        expect(form).not_to_be_visible()
        assert screenplay()['revisionRequest']['sceneIds'] == ['platform']
        assert len(planning()['calls']) == 1
        planning_limit('revise_script')
        page.locator('[data-operation=revise_script]:enabled').last.click()
        expect(page.locator('[data-poll-planning]')).to_be_visible()
        review_completed('revise_script')
        assert screenplay()['currentVersion'] == 1 and screenplay()['approved'] is True
        page.locator('#apply-screenplay-proposal').click()
        expect(page.locator('#screenplay-proposal-dialog')).not_to_be_visible()
        revised = screenplay()
        assert revised['currentVersion'] == 2 and revised['approved'] is False
        assert revised['screenplay']['document']['scenes'][1] == original['scenes'][1]
        assert revised['screenplay']['document']['characters'] == original['characters']
        assert revised['screenplay']['document']['scenes'][0]['action'] != original['scenes'][0]['action']
        assert len(project()['screenplay']['versions']) == 2
        assert len(planning()['calls']) == 2
        # Unsaved text remains attached to this project and locks its field selector after navigation.
        page.locator('#edit-screenplay').click()
        edit_form = page.locator('#script-field-form')
        unsaved = 'Keep this unsaved treatment exactly while I check the cast.'
        edit_form.locator('[name=value]').fill(unsaved)
        expect(edit_form.locator('[name=field]')).to_be_disabled()
        page.locator('#rail [data-stage=cast]').click()
        page.locator('#rail [data-stage=story]').click()
        expect(page.locator('#script-field-form [name=value]')).to_have_value(unsaved)
        expect(page.locator('#script-field-form [name=field]')).to_be_disabled()
        assert screenplay()['currentVersion'] == 2
        assert len(planning()['calls']) == 2
        page.locator('#script-field-form [data-cancel-script-edit]').click()
        expect(page.locator('#script-field-form')).to_have_count(0)
        passed.append('Unsaved screenplay field text survives in-app stage navigation; its selector remains locked and cancel leaves saved script unchanged')
        passed.append('Saved targeted revision is free until explicitly run; applying changes the selected scene, preserves other scene and characters, retains history and requires renewed approval')
        page.set_viewport_size({'width': 390, 'height': 844})
        page.reload()
        expect(page.locator('#screenplay-workspace')).to_be_visible()
        page.locator('#approve-screenplay').scroll_into_view_if_needed()
        mobile = page.evaluate('''()=>{const r=document.querySelector('#screenplay-workspace').getBoundingClientRect(),a=document.querySelector('#approve-screenplay').getBoundingClientRect();return {width:innerWidth,height:innerHeight,workspaceLeft:r.left,workspaceRight:r.right,approvalTop:a.top,approvalBottom:a.bottom,overflow:document.documentElement.scrollWidth>innerWidth};}''')
        assert not mobile['overflow'], mobile
        assert mobile['workspaceLeft'] >= -1 and mobile['workspaceRight'] <= mobile['width'] + 1, mobile
        page.screenshot(path=str(out / 'writing-script-mobile-viewport.png'), full_page=True)
        passed.append('390px Chromium viewport renders screenplay without horizontal overflow; this is not physical mobile verification')
        page.set_viewport_size({'width': 1440, 'height': 1000})
        # The second project proves the optional upload path through real file selection.
        created = page.request.post(base + '/api/projects', data={'title': 'Supplied script browser proof', 'premise': 'Asha prepares tea after the rain.'})
        assert created.ok, created.text()
        second_id = created.json()['project']['id']
        project_url = base + '/api/projects/' + second_id
        page.evaluate('(id)=>localStorage.setItem("director:lastProject",id)', second_id)
        # The init script selects the initial project on every navigation; replace it in a fresh page.
        page.close()
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.set_default_timeout(15000)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('response', lambda r: http.append({'status': r.status, 'url': r.url}) if r.status >= 400 else None)
        page.on('dialog', lambda dialog: dialog.accept())
        page.add_init_script("localStorage.setItem('director:lastProject'," + json.dumps(second_id) + ")")
        page.goto(base)
        approve_direction()
        page.locator('.script-sources>summary').click()
        supplied = '\ufeff\nINT. KITCHEN — MORNING\r\n\r\nAsha opens a tin of tea.\r\n\r\nASHA\r\nThe rain has finally stopped.\r\n\r\nShe sets two cups beside the window.\r\n'
        page.locator('#script-source-file').set_input_files({'name': 'ashas-original.txt', 'mimeType': 'text/plain', 'buffer': supplied.encode('utf-8')})
        form = page.locator('#script-source-form')
        expect(form).to_be_visible()
        expect(form.locator('[name=text]')).to_have_attribute('readonly', '')
        # The textarea normalizes line endings; compare persisted source bytes, not its DOM value.
        form.locator('[name=title]').fill('Asha original — exact UTF-8 source')
        form.locator('[name=permittedUse]').select_option('user_owned')
        form.locator('button[type=submit]').click()
        expect(form).not_to_be_visible()
        assert screenplay()['sources'][0]['text'] == supplied
        assert screenplay()['screenplay'] is None and not planning()['calls']
        page.locator('.script-sources>summary').click()
        page.locator('[data-use-script-source]').click()
        expect(page.locator('.script-originality')).to_contain_text('passage match')
        assert screenplay()['screenplay']['document']['scenes'][0]['action'] == supplied
        assert screenplay()['screenplay']['provenance']['kind'] == 'user_supplied'
        page.locator('#screenplay-coverage-ack').check()
        page.locator('#approve-screenplay').click()
        expect(page.locator('#screenplay-status')).to_contain_text('record an explicit use declaration')
        assert screenplay()['approved'] is False
        while page.locator('[data-review-script-finding]').count():
            page.locator('[data-review-script-finding]').first.click()
            form = page.locator('#script-finding-form')
            form.locator('[name=note]').fill('I supplied and own this original passage, and I authorize its use in this project.')
            form.locator('button[type=submit]').click()
            expect(form).not_to_be_visible()
        page.locator('#screenplay-coverage-ack').check()
        page.locator('#approve-screenplay').click()
        expect(page.locator('#approve-screenplay')).to_have_text('Script approved')
        page.reload()
        assert screenplay()['sources'][0]['text'] == supplied and screenplay()['approved'] is True
        assert not planning()['calls']
        page.screenshot(path=str(out / 'writing-supplied-script-desktop.png'), full_page=True)
        passed.append('Optional .txt upload preserves exact UTF-8 BOM, leading newline, CRLF source text and declared provenance, never calls a model, exposes deterministic matches and requires passage-use explanations before approval; source and review survive reload')
        # Recheck the previously fixed briefing footer after the writing changes.
        page.set_viewport_size({'width': 390, 'height': 844})
        page.locator('#mobile-project').click()
        page.locator('#rail [data-stage=brief]').click()
        expect(page.locator('#compact-brief')).to_be_visible()
        for width, height in [(390, 880), (390, 844), (375, 812), (360, 640), (390, 520)]:
            page.set_viewport_size({'width': width, 'height': height})
            geometry = page.evaluate('''()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom};};return {width:innerWidth,height:innerHeight,composer:box('.brief-conversation>.composer'),note:box('.brief-conversation>.composer-note'),footer:box('.briefing>.mobile-tools'),overflow:document.documentElement.scrollWidth>innerWidth};}''')
            assert geometry['composer']['bottom'] <= geometry['note']['top'] + .5, geometry
            assert geometry['note']['bottom'] <= geometry['footer']['top'] + .5, geometry
            assert geometry['footer']['bottom'] <= height + .5, geometry
            assert not geometry['overflow'], geometry
            geometries.append(geometry)
        passed.append('Briefing composer, note and footer remain separated across five desktop-emulated mobile viewport sizes')
        injected_http = [item for item in http if stage_failure and item['status'] == 503 and item['url'] == initial_project_url]
        injected_console = [message for message in errors if stage_failure and '503' in message and 'Failed to load resource' in message]
        assert len(injected_http) == (1 if stage_failure else 0), http
        assert len(injected_console) == (1 if stage_failure else 0), errors
        unexpected_errors = [message for message in errors if message not in injected_console]
        unexpected_http = [item for item in http if item not in injected_http]
        assert not unexpected_errors, unexpected_errors
        assert not unexpected_http, unexpected_http
        result = {'scope': 'Actual local HTTP APIs, LocalStore and Chromium interactions; server-side simulated OpenAI responses; no browser request interception', 'passed': passed, 'consoleErrors': unexpected_errors, 'httpErrors': unexpected_http, 'controlledStageFailure': stage_failure, 'expectedInjectedConsoleErrors': injected_console, 'expectedInjectedHttpErrors': injected_http, 'mobileScriptGeometry': mobile, 'footerGeometry': geometries, 'realPaidCalls': 0, 'simulatedWritingCalls': 2, 'physicalMobileTested': False, 'deployedWebsiteTested': False, 'limitations': ['No real OpenAI writing or quality evaluation', 'No external originality corpus', 'No physical phone or virtual keyboard testing', 'No Supabase account or deployed-site tests']}
        (out / ('writing-stage-recovery-results.json' if stage_failure else 'writing-browser-results.json')).write_text(json.dumps(result, indent=2))
        print(json.dumps(result))
        browser.close()
finally:
    server.terminate()
    try:
        server.wait(timeout=4)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait()
