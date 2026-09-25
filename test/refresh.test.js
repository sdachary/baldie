const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFreeForDev, parseAwesomeSelfhosted } = require('../scripts/refresh-free-tier.js');

const FFD = `# free-for.dev

## Cloud Providers

  * [Cloudflare](https://www.cloudflare.com/)
    * [Workers](https://developers.cloudflare.com/workers/) - Deploy serverless code free, 100k req/day.
    * [D1](https://developers.cloudflare.com/d1/) - 5 million rows read/day.
  * [ExampleCo](https://exampleco.com) - One-line free tier desc.

## Database

  * [Neon](https://neon.tech) - Branching Postgres, 190 compute hrs/mo.
`;

const ASH = `# awesome-selfhosted

### Analytics

- [ANALOG](https://github.com/orangecoloured/analog) - A minimal analytics tool. \`MIT\` \`Nodejs/Docker\`
- [Aptabase](https://aptabase.com/) - Privacy first analytics. ([Source Code](https://github.com/aptabase/aptabase)) \`AGPL-3.0\` \`Docker\`

### Automation

- [n8n](https://github.com/n8n-io/n8n) - Workflow automation. \`Fair Use\` \`Nodejs/Docker\`
`;

test('parseFreeForDev: provider bullet becomes provider for nested offers', () => {
  const e = parseFreeForDev(FFD);
  const workers = e.find((x) => x.name === 'Workers');
  assert.ok(workers);
  assert.equal(workers.provider, 'Cloudflare');
  assert.equal(workers.category, 'Cloud Providers');
  assert.equal(workers.url, 'https://developers.cloudflare.com/workers/');
  const d1 = e.find((x) => x.name === 'D1');
  assert.equal(d1.provider, 'Cloudflare');
  const neon = e.find((x) => x.name === 'Neon');
  assert.equal(neon.category, 'Database');
  assert.equal(neon.url, 'https://neon.tech');
});

test('parseFreeForDev: flat bullet uses its own title as provider', () => {
  const e = parseFreeForDev(FFD);
  const ex = e.find((x) => x.name === 'ExampleCo');
  assert.equal(ex.provider, 'ExampleCo');
  assert.equal(ex.desc, 'One-line free tier desc.');
});

test('parseFreeForDev: strips non-http anchors (toc, images)', () => {
  const e = parseFreeForDev(`[Table of Contents](#toc)\n\n  * [Rel](https://reliability.example) - ok\n  * [Anchor](https://e.example#section) - ok\n`);
  assert.equal(e.every((x) => x.url.startsWith('http')), true);
});

test('parseAwesomeSelfhosted: category + desc without license badges', () => {
  const e = parseAwesomeSelfhosted(ASH);
  assert.equal(e.length, 3);
  const analog = e.find((x) => x.name === 'ANALOG');
  assert.equal(analog.category, 'Analytics');
  assert.equal(analog.desc, 'A minimal analytics tool.');
  const n8n = e.find((x) => x.name === 'n8n');
  assert.equal(n8n.category, 'Automation');
});

test('parseAwesomeSelfhosted: drops TOC anchors', () => {
  const e = parseAwesomeSelfhosted('## Table of contents\n  - [Analytics](#analytics)\n### Analytics\n- [OK](https://ok.example) - fine\n');
  assert.equal(e.length, 1);
  assert.equal(e[0].name, 'OK');
});