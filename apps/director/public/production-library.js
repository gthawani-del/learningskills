const TYPES = ['character', 'voice', 'location', 'wardrobe', 'prop', 'audio', 'take', 'edit'];
const label = type => TYPES.includes(type) ? type[0].toUpperCase() + type.slice(1) : 'Reference';
const compatible = (type, asset) => {
  const mime = asset.mime || '';
  if (['character', 'location', 'wardrobe', 'prop'].includes(type)) return mime.startsWith('image/');
  if (['voice', 'audio'].includes(type)) return mime.startsWith('audio/');
  if (type === 'take') return /^(audio|video)\//.test(mime);
  return type === 'edit' && /^(image|audio|video)\//.test(mime);
};
const referenceOptions = (assets, type) => assets.filter(a => compatible(type, a)).map(a => option(a.id, `${a.name || a.filename || 'Reference'} · v${a.version || 1}`)).join('');
const FIELDS = ['description', 'language', 'performance', 'script'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const records = project => Array.isArray(project?.production?.records) ? project.production.records : Array.isArray(project?.productionRecords) ? project.productionRecords : [];
const current = record => (record.versions || []).find(v => v.version === record.currentVersion) || record.versions?.at(-1) || record;
const version = record => current(record).version ?? record.currentVersion ?? record.version ?? 1;
const title = record => record.name || current(record).name || 'Untitled';
const option = (value, label, selected = false) => `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;

const versionLinks = (item, list, assets) => {
  const references = (item.references || []).map(ref => {
    const asset = assets.find(a => a.id === ref.assetId);
    return `${asset?.name || asset?.filename || 'Unavailable reference'} · v${ref.version}`;
  });
  const dependencies = (item.dependencies || []).map(dep => {
    const record = list.find(r => r.id === dep.recordId);
    const snapshot = record?.versions?.find(v => v.version === dep.version);
    return `${snapshot?.name || (record && title(record)) || 'Unavailable library record'} · v${dep.version}`;
  });
  return `<p class="small">References: ${esc(references.join('; ') || 'None')}</p><p class="small">Related records: ${esc(dependencies.join('; ') || 'None')}</p>`;
};

export function renderProductionLibrary(project, assets = [], review = {approvals: [], dependencies: null}) {
  const list = records(project);
  return `<section class="panel"><h2>Cast &amp; world library</h2><p class="muted small">Planning and reference records keep creative choices together. Saving a version does not generate media or approve production.</p>${list.length ? list.map(record => {
    const item = current(record);
    const check = review?.dependencies?.records?.find(r => r.recordId === record.id && r.version === version(record));
    const holds = check?.holds || [];
    const latest = (review?.approvals || []).filter(a => a.artifactId === 'record:' + record.id && a.version === version(record)).at(-1);
    const approved = latest?.decision === 'approved';
    const state = approved ? 'Creative version approved' : latest?.decision === 'revoked' ? 'Creative approval revoked' : latest?.decision === 'rejected' ? 'Creative version needs revision' : 'Creative version awaiting review';
    const history = (record.versions || []).filter(v => v.version !== version(record)).slice().reverse();
    return `<article><div class="row"><h3>${esc(title(record))}</h3><button type="button" data-edit-record="${esc(record.id)}">Edit version</button></div><p class="muted small">${esc(label(record.type))} · Version ${esc(version(record))}</p><p>${esc(item.content?.description || 'No description yet.')}</p>${versionLinks(item, list, assets)}<p class="small" data-creative-status>${esc(state)} · v${esc(version(record))}</p>${!check ? '<p class="muted small">Dependency review has not been checked for this version.</p>' : holds.length ? `<p class="small">Review held: ${esc(holds.join(' '))}</p>` : '<p class="muted small">Linked versions are current. Related records need their own creative review.</p>'}<div class="actions"><button type="button" data-review-record="${esc(record.id)}" data-review-decision="approved" data-review-held="${!check || holds.length ? 'true' : 'false'}" data-review-version="${esc(version(record))}"${!check || holds.length || approved ? ' disabled' : ''}>Approve creative version</button><button type="button" data-review-record="${esc(record.id)}" data-review-decision="revoked" data-review-version="${esc(version(record))}"${approved ? '' : ' disabled'}>Revoke creative approval</button></div><p class="muted small">Creative approval covers this planning version only. Rights, media quality and permission to generate require separate review.</p><p class="small" data-review-status role="status" aria-live="polite"></p><details><summary>Version history · ${history.length} earlier ${history.length === 1 ? 'version' : 'versions'}</summary>${history.length ? history.map(snapshot => `<section><h4>Version ${esc(snapshot.version)} · ${esc(snapshot.name || title(record))}</h4><p>${esc(snapshot.content?.description || 'No description recorded.')}</p>${versionLinks(snapshot, list, assets)}</section>`).join('') : '<p class="muted small">Earlier saved versions will appear here.</p>'}</details></article>`;
  }).join('') : '<p class="muted">Add your first character, voice, location or other production reference below.</p>'}</section><form id="production-record-form" class="panel"><h2 data-record-heading>Add a library record</h2><p class="muted small">Audio and take entries organize existing files and creative direction. They do not create generated or approved output.</p><input type="hidden" name="recordId" value=""><div class="row"><label>Type<select name="type">${TYPES.map(type => option(type, label(type))).join('')}</select></label><label>Name<input name="name" required maxlength="200"></label></div><label>Description<textarea name="description"></textarea></label><div class="row"><label>Language<input name="language"></label><label>Performance<input name="performance"></label></div><label>Script<textarea name="script"></textarea></label><label>Reference assets<select name="referenceIds" multiple>${referenceOptions(assets, 'character')}</select></label><label>Related library records<select name="dependencyIds" multiple>${list.map(r => option(r.id, `${title(r)} · v${version(r)}`)).join('')}</select></label><p class="muted small">Choose any references and related records that guide this version. Use Ctrl or Command to select more than one.</p><div class="actions"><button type="submit" class="primary">Save new version</button><button type="button" data-new-record>Start another record</button></div><p data-record-status class="small" role="status" aria-live="polite"></p></form>`;
}

export function bindProductionLibrary(root, {project, assets = [], onSave, onReview}) {
  root.querySelectorAll('[data-review-record]').forEach(button => {
    if (typeof onReview !== 'function') { button.disabled = true; return; }
    button.onclick = async () => {
      if (button.disabled) return;
      const record = records(project).find(r => r.id === button.dataset.reviewRecord);
      const selectedVersion = Number(button.dataset.reviewVersion);
      const decision = button.dataset.reviewDecision;
      if (!record || selectedVersion !== version(record) || !['approved', 'revoked'].includes(decision)) return;
      const article = button.closest('article');
      const buttons = Array.from(article.querySelectorAll('[data-review-record]'));
      const disabled = buttons.map(b => b.disabled);
      const status = article.querySelector('[data-review-status]');
      buttons.forEach(b => { b.disabled = true; });
      status.textContent = 'Saving creative review…';
      let saved = false;
      try {
        await onReview({recordId: record.id, version: selectedVersion, decision, expectedVersion: project.version});
        article.querySelector('[data-creative-status]').textContent = `${decision === 'approved' ? 'Creative version approved' : 'Creative approval revoked'} · v${selectedVersion}`;
        status.textContent = 'Creative review saved.';
        buttons.forEach(b => { b.disabled = b.dataset.reviewDecision === 'revoked' ? decision !== 'approved' : decision === 'approved' || b.dataset.reviewHeld === 'true'; });
        saved = true;
      } catch (error) {
        status.textContent = error?.message || 'The creative review could not be saved. Try again.';
      } finally {
        if (!saved) buttons.forEach((b, i) => { b.disabled = disabled[i]; });
      }
    };
  });
  const form = root.querySelector('#production-record-form');
  if (!form) return;
  const list = records(project);
  const field = name => form.elements.namedItem(name);
  const status = form.querySelector('[data-record-status]');
  const updateReferences = (selected = Array.from(field('referenceIds').selectedOptions, o => o.value)) => {
    field('referenceIds').innerHTML = referenceOptions(assets, field('type').value);
    Array.from(field('referenceIds').options).forEach(o => { o.selected = selected.includes(o.value); });
  };
  field('type').onchange = () => updateReferences();
  const reset = () => {
    form.reset();
    field('recordId').value = '';
    field('type').disabled = false;
    updateReferences([]);
    form.querySelector('[data-record-heading]').textContent = 'Add a library record';
    Array.from(field('dependencyIds').options).forEach(o => { o.disabled = false; o.selected = false; });
    status.textContent = '';
  };
  form.querySelector('[data-new-record]').onclick = reset;
  root.querySelectorAll('[data-edit-record]').forEach(button => {
    button.onclick = () => {
      const record = list.find(r => r.id === button.dataset.editRecord);
      if (!record) return;
      reset();
      const item = current(record);
      field('recordId').value = record.id;
      field('type').value = record.type;
      field('type').disabled = true;
      updateReferences((item.references || []).map(r => r.assetId));
      field('name').value = title(record);
      FIELDS.forEach(name => { field(name).value = typeof item.content?.[name] === 'string' ? item.content[name] : ''; });
      for (const [name, values] of [['referenceIds', (item.references || []).map(r => r.assetId)], ['dependencyIds', (item.dependencies || []).map(r => r.recordId)]]) {
        Array.from(field(name).options).forEach(o => { o.selected = values.includes(o.value); o.disabled = name === 'dependencyIds' && o.value === record.id; });
      }
      form.querySelector('[data-record-heading]').textContent = `Edit ${title(record)} · save a new version`;
      field('name').focus();
    };
  });
  form.onsubmit = async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const id = field('recordId').value;
    const record = list.find(r => r.id === id);
    const type = field('type').value;
    if (!TYPES.includes(type) || (id && !record)) return;
    const content = {...(record ? current(record).content : {})};
    FIELDS.forEach(name => { content[name] = field(name).value; });
    const references = Array.from(field('referenceIds').selectedOptions).flatMap(o => {
      const asset = assets.find(a => a.id === o.value && compatible(type, a));
      return asset ? [{assetId: asset.id, version: asset.version || 1}] : [];
    });
    const dependencies = Array.from(field('dependencyIds').selectedOptions).flatMap(o => {
      const dependency = list.find(r => r.id === o.value && r.id !== id);
      return dependency ? [{recordId: dependency.id, version: version(dependency)}] : [];
    });
    const button = form.querySelector('[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = 'Saving library version…';
    try {
      await onSave({...(id ? {id} : {}), type, name: field('name').value.trim(), content, references, dependencies, expectedVersion: project.version});
      status.textContent = 'Library version saved.';
    } catch (error) {
      status.textContent = error?.message || 'The version could not be saved. Your changes are still here; try again.';
    } finally { button.disabled = false; }
  };
}

export function renderProductionBindings(project, shot) {
  const list = records(project);
  const bindings = shot?.productionBindings || [];
  const selected = new Set(bindings.map(b => `${b.recordId}@${b.version}`));
  const options = list.map(record => option(`${record.id}@${version(record)}`, `${title(record)} · ${label(record.type)} · v${version(record)}`, selected.has(`${record.id}@${version(record)}`)));
  bindings.forEach(binding => {
    const record = list.find(r => r.id === binding.recordId);
    if (record && version(record) === binding.version) return;
    options.push(option(`${binding.recordId}@${binding.version}`, `${record ? title(record) : 'Unavailable library record'} · v${binding.version} · older version`, true));
  });
  return `<label>Cast &amp; world for this shot<select name="productionBindings" multiple>${options.join('')}</select></label><p class="muted small">Choose the library versions that guide this shot. Older versions remain selected until you change them.</p>`;
}
