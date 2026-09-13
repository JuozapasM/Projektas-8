const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('Supabase configuration rejects malformed URLs, credentials and placeholders', () => {
  const js = ts.transpileModule(fs.readFileSync('src/lib/supabase/env.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  function resolve(url, key, extra = {}) {
    const exports = {};
    vm.runInNewContext(js, { exports, URL, process: { env: { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key, ...extra } } });
    return exports.getSupabaseEnv();
  }
  for (const url of ['', 'not-a-url', 'https://your-project-id.supabase.co', 'file:///tmp/db', 'https://user:password@db.example.com']) assert.equal(resolve(url, 'public-key').isConfigured, false);
  assert.equal(resolve('https://db.example.com', 'your-anon-key').isConfigured, false);
  assert.equal(resolve(undefined, undefined, { SUPABASE_URL: 'https://db.example.com', SUPABASE_ANON_KEY: 'public-key' }).isConfigured, false);
  const result = resolve(' https://db.example.com ', ' public-key ');
  assert.equal(result.isConfigured, true);
  assert.equal(result.url, 'https://db.example.com');
  assert.equal(result.anonKey, 'public-key');
});
