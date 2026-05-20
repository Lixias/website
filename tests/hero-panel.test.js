const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'httpdocs', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'httpdocs', 'js', 'main.js'), 'utf8');

assert(html.includes('class="signal-card now-card"'), 'index.html should include the current focus card');
assert(html.includes('Current focus'), 'index.html should label the current focus card');
assert(html.includes('Practical automation'), 'current focus card should mention practical automation');
assert(html.includes('Reliable operations'), 'current focus card should mention reliable operations');
assert(html.includes('AI-assisted engineering workflows'), 'current focus card should mention AI-assisted workflows');
assert((html.match(/<div class="focus-list"/g) || []).length === 1, 'index.html should include one focus list');
assert(!html.includes('data-site-stats'), 'index.html should not include obsolete stats hooks');
assert((html.match(/mailto:lauri@laurikohtamaki\.fi/g) || []).length === 1, 'index.html should include one email contact card');
assert(html.includes('<span>Email</span>'), 'email contact card should be labeled Email');

const css = fs.readFileSync(path.join(root, 'httpdocs', 'css', 'styles.css'), 'utf8');
const rule = selector => (css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`)) || [])[1] || '';
const systemPanelRule = rule('.system-panel');
const canvasRule = rule('#grid-canvas');
const panelOverlayRule = rule('.panel-overlay');

assert(css.includes('grid-template-areas'), 'system panel overlay should use grid areas for card placement');
assert(css.includes('"status"') && css.includes('"focus"') && css.includes('"commit"') && css.includes('"now"'), 'mobile panel overlay should use one-column grid areas');
assert(/--space-[\w-]+:/.test(css), 'stylesheet should define reusable spacing tokens');
assert(/position:\s*absolute/.test(canvasRule), 'canvas should stay an absolute background layer');
assert(/position:\s*relative/.test(panelOverlayRule), 'panel overlay should stay in normal flow so it sizes the panel');
assert(!/position:\s*absolute/.test(panelOverlayRule), 'panel overlay should not be absolute because absolute content does not size the panel');
assert(!/min-block-size:/.test(systemPanelRule), 'system panel should grow from in-flow overlay content');
assert(/@media \(max-width: 53\.75rem\)[\s\S]*\.now-card\s*\{[\s\S]*align-self: end;[\s\S]*\}/.test(css), 'mobile current focus card should keep content height at the bottom of its grid row');
assert(/\.contact-card:first-child\s*\{[\s\S]*grid-column: 1 \/ -1;[\s\S]*\}/.test(css), 'email contact card should span the full contact grid row');
assert(css.includes('.focus-list'), 'stylesheet should style the current focus list');

assert(!js.includes('/api/public-stats.php'), 'main.js should not fetch obsolete public stats endpoint');
assert(!js.includes('renderSiteStats'), 'main.js should not include obsolete stats rendering');

console.log('hero panel content verified');
