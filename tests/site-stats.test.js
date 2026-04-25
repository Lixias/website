const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'httpdocs', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'httpdocs', 'js', 'main.js'), 'utf8');

assert(html.includes('data-site-stats-card'), 'index.html should include the site stats card hook');
assert(html.includes('data-site-stats-visitors'), 'index.html should include the visitors metric hook');
assert(html.includes('data-site-stats-visits'), 'index.html should include the visits metric hook');
assert(html.includes('data-site-stats-ratio'), 'index.html should include the visits-per-visitor metric hook');
assert(html.includes('data-site-stats-last-visit'), 'index.html should include the last visit hook');
assert(html.includes('data-site-stats-updated'), 'index.html should include the updated hook');
assert((html.match(/<div class="metric">/g) || []).length >= 3, 'index.html should group stats as metric items');
assert(html.includes('data-site-stats-summary'), 'index.html should include one analytics live summary hook');
assert((html.match(/mailto:lauri@laurikohtamaki\.fi/g) || []).length === 1, 'index.html should include one email contact card');
assert(html.includes('<span>Email</span>'), 'email contact card should be labeled Email');

const css = fs.readFileSync(path.join(root, 'httpdocs', 'css', 'styles.css'), 'utf8');
assert(css.includes('grid-template-areas'), 'system panel overlay should use grid areas for card placement');
assert(css.includes('"status"') && css.includes('"focus"') && css.includes('"commit"') && css.includes('"analytics"'), 'mobile panel overlay should use one-column grid areas');
assert(css.includes('padding: 18px 24px 72px'), 'panel overlay should create a wide bottom gap');
assert(css.includes('margin-bottom: 0'), 'analytics card should not add separate bottom spacing inside the overlay');
assert(/@media \(max-width: 860px\)[\s\S]*\.analytics-card\s*\{[\s\S]*align-self: end;[\s\S]*\}/.test(css), 'mobile analytics card should keep content height at the bottom of its grid row');
assert(/\.contact-card:first-child\s*\{[\s\S]*grid-column: 1 \/ -1;[\s\S]*\}/.test(css), 'email contact card should span the full contact grid row');
assert(css.includes('font-variant-numeric: tabular-nums'), 'analytics values should use tabular numbers for alignment');

assert(js.includes('function renderSiteStats'), 'main.js should define renderSiteStats');
assert(js.includes("'/api/public-stats.php'"), 'main.js should fetch public stats endpoint');
assert(js.includes('siteStatsSummary'), 'main.js should update a single stats live summary');

console.log('site stats frontend hooks verified');
