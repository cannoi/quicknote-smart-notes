const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('project files are present', () => {
  assert.ok(fs.existsSync('package.json'), 'package.json');
  assert.ok(fs.existsSync('server.js'), 'server.js');
  assert.ok(fs.existsSync('public/index.html'), 'public/index.html');
  assert.ok(fs.existsSync('Dockerfile'), 'Dockerfile');
});
