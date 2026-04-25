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

assert(js.includes('function renderSiteStats'), 'main.js should define renderSiteStats');
assert(js.includes("'/api/public-stats.php'"), 'main.js should fetch public stats endpoint');

console.log('site stats frontend hooks verified');
