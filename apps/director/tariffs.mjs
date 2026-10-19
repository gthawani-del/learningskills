import { hash } from './domain.mjs';
const plain = x => !!x && typeof x === 'object' && !Array.isArray(x) && [Object.prototype, null].includes(Object.getPrototypeOf(x));
const positive = x => Number.isSafeInteger(x) && x > 0;
const nonnegative = x => Number.isSafeInteger(x) && x >= 0;
const units = new Set(['second', 'image', 'input_image', 'character', 'request', 'megapixel', 'thousand_character', 'reference_token', 'output_token']);
function block(message) { throw Object.assign(new Error(message), { status: 409 }); }
function https(value) { try { const u = new URL(value); return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password; } catch { return false; } }
function boundedNumber(value, name) { if (value > BigInt(Number.MAX_SAFE_INTEGER)) block(`${name} exceeds safe integer precision.`); return Number(value); }
function decimal(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) block('Explicit duration must be a finite nonnegative number.');
  const text = String(value);
  if (!/^\d+(?:\.\d{1,9})?$/.test(text)) block('Duration precision is unsupported; provide a verified usage bound.');
  const [whole, fraction = ''] = text.split('.');
  return [BigInt(whole + fraction), 10n ** BigInt(fraction.length)];
}
function measured(component, usageEvidence, price, input) {
  const entry = usageEvidence?.components?.[component.id];
  if (!plain(usageEvidence) || usageEvidence.verified !== true || usageEvidence.priceVersion !== price.version || usageEvidence.inputHash !== hash(input) || typeof usageEvidence.measurementVersion !== 'string' || !usageEvidence.measurementVersion.trim() || !plain(entry) || entry.bounded !== true || !nonnegative(entry.quantity)) block(`A server-verified, input-bound usage upper bound is required for ${component.id}.`);
  return [BigInt(entry.quantity), 1n];
}
function characterCount(input, component) {
  if (typeof input.text !== 'string') block('Character tariffs require explicit input.text.');
  if (!['unicode_codepoint', 'utf16_code_unit', 'utf8_byte'].includes(component.characterCounting)) block('Provider-verified character counting convention is required.');
  return BigInt(component.characterCounting === 'unicode_codepoint' ? [...input.text].length : component.characterCounting === 'utf8_byte' ? Buffer.byteLength(input.text, 'utf8') : input.text.length);
}
function quantity(component, input, usageEvidence, price) {
  if (['reference_token', 'output_token'].includes(component.unit)) return measured(component, usageEvidence, price, input);
  if (component.unit === 'request') return [1n, 1n];
  if (component.unit === 'input_image') {
    if (!Array.isArray(input.image_urls) || !input.image_urls.length || input.image_urls.length > 10 || input.image_urls.some(url => !https(url))) block('Input-image pricing requires 1–10 explicit HTTPS image references.');
    return [BigInt(input.image_urls.length), 1n];
  }
  if (component.unit === 'second') {
    if (typeof input.duration !== 'number' || input.duration <= 0) return measured(component, usageEvidence, price, input);
    return decimal(input.duration);
  }
  if (component.unit === 'character' || component.unit === 'thousand_character') return [characterCount(input, component), component.unit === 'character' ? 1n : 1000n];
  if (!positive(input.num_images)) block('Image tariffs require explicit positive num_images; no model default is inferred.');
  if (component.unit === 'image') return [BigInt(input.num_images), 1n];
  const size = input.image_size;
  if (!plain(size) || !positive(size.width) || !positive(size.height)) block('Megapixel tariffs require explicit exact output width and height.');
  return [BigInt(size.width) * BigInt(size.height) * BigInt(input.num_images), 1000000n];
}
export function validateTariff(tariff) {
  if (!plain(tariff) || Object.keys(tariff).some(k => !['schemaVersion', 'version', 'components'].includes(k)) || tariff.schemaVersion !== 1 || typeof tariff.version !== 'string' || !tariff.version.trim() || !Array.isArray(tariff.components) || !tariff.components.length || tariff.components.length > 20) block('Unsupported tariff schema.');
  const seen = new Set();
  for (const component of tariff.components) {
    if (!plain(component) || Object.keys(component).some(k => !['id', 'unit', 'rate', 'minimumUnits', 'includedUnits', 'characterCounting', 'rounding'].includes(k)) || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(component.id || '') || seen.has(component.id) || !units.has(component.unit) || component.rounding !== 'ceil' || !plain(component.rate) || Object.keys(component.rate).some(k => !['numeratorMicroUsd', 'denominatorUnits'].includes(k)) || !positive(component.rate.numeratorMicroUsd) || !positive(component.rate.denominatorUnits) || ('minimumUnits' in component && !nonnegative(component.minimumUnits)) || ('includedUnits' in component && !nonnegative(component.includedUnits))) block('Invalid tariff component or rounding policy.');
    seen.add(component.id);
    if (['character', 'thousand_character'].includes(component.unit) && !['unicode_codepoint', 'utf16_code_unit', 'utf8_byte'].includes(component.characterCounting)) block('Provider-verified character counting convention is required.');
  }
  return tariff;
}
// Pure quote arithmetic. Callers must pass registry pricing and server-observed
// usage evidence, never forward a browser-supplied price or usageEvidence object.
export function calculateTariff({ price, input, usageEvidence, now = Date.now() } = {}) {
  const time = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : typeof now === 'string' ? Date.parse(now) : NaN;
  if (!Number.isFinite(time)) block('Invalid tariff evaluation time.');
  if (!plain(price) || price.verified !== true || price.configurationVerified !== true || !plain(price.configuration) || typeof price.version !== 'string' || !price.version.trim() || price.currency !== 'USD' || !https(price.sourceUrl) || typeof price.expiresAt !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(price.expiresAt) || !(Date.parse(price.expiresAt) > time)) block('Fresh verified USD pricing with explicit configuration is required.');
  if (!plain(input)) block('Exact provider input required.');
  for (const [key, value] of Object.entries(price.configuration)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) || !['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value)) || input[key] !== value) block('Price configuration must match exact explicit provider input.');
  }
  const tariff = validateTariff(price.tariff);
  if (!plain(tariff) || Object.keys(tariff).some(k => !['schemaVersion', 'version', 'components'].includes(k)) || tariff.schemaVersion !== 1 || tariff.version !== price.version || !Array.isArray(tariff.components) || !tariff.components.length || tariff.components.length > 20) block('Unsupported or unbound tariff schema.');
  const seen = new Set();
  let total = 0n;
  const components = tariff.components.map(component => {
    if (!plain(component) || Object.keys(component).some(k => !['id', 'unit', 'rate', 'minimumUnits', 'includedUnits', 'characterCounting', 'rounding'].includes(k)) || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(component.id || '') || seen.has(component.id) || !units.has(component.unit) || component.rounding !== 'ceil' || !plain(component.rate) || Object.keys(component.rate).some(k => !['numeratorMicroUsd', 'denominatorUnits'].includes(k)) || !positive(component.rate.numeratorMicroUsd) || !positive(component.rate.denominatorUnits) || ('minimumUnits' in component && !nonnegative(component.minimumUnits)) || ('includedUnits' in component && !nonnegative(component.includedUnits))) block('Invalid tariff component or rounding policy.');
    seen.add(component.id);
    const [raw, denominator] = quantity(component, input, usageEvidence, price);
    const allowance = BigInt(component.includedUnits ?? 0) * denominator;
    const afterAllowance = raw > allowance ? raw - allowance : 0n;
    const minimum = BigInt(component.minimumUnits ?? 0) * denominator;
    const billed = afterAllowance > minimum ? afterAllowance : minimum;
    const numerator = billed * BigInt(component.rate.numeratorMicroUsd);
    const divisor = denominator * BigInt(component.rate.denominatorUnits);
    const cost = (numerator + divisor - 1n) / divisor;
    total += cost;
    return { id: component.id, unit: component.unit, quantityNumerator: raw.toString(), quantityDenominator: denominator.toString(), billableNumerator: billed.toString(), billableDenominator: denominator.toString(), includedUnits: component.includedUnits ?? 0, minimumUnits: component.minimumUnits ?? 0, rounding: 'ceil', costMicroUsd: boundedNumber(cost, 'Component charge') };
  });
  return { totalMicroUsd: boundedNumber(total, 'Total charge'), components };
}
