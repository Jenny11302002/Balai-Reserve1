/**
 * Converts synchronous db.prepare().get/all/run() calls to async/await.
 * Uses regex but carefully avoids double-async.
 */
const fs   = require('fs');
const path = require('path');
const glob = require('child_process').execSync(
  'git ls-files src/modules src/utils src/middleware app.js',
  { encoding: 'utf8' }
).trim().split('\n').filter(f => f.endsWith('.js'));

let totalFixed = 0;

for (const file of glob) {
  let src = fs.readFileSync(file, 'utf8');
  const original = src;

  // 1. Add await before db.prepare(...) that is NOT already awaited
  src = src.replace(/(?<!await\s)(?<!await\s{1,10})(db\.prepare\()/g, 'await $1');

  // 2. Make router.METHOD(path, ..., handler) where handler=(req,res) => async
  //    Pattern: last arg is (req, res) => or (req, res, next) =>  without async
  src = src.replace(
    /(\brouter\.\w+\([^;]*?,\s*)(?!async\s*)(\(req,\s*res(?:,\s*next)?\)\s*=>)/g,
    '$1async $2'
  );

  // 3. Same for function (req, res)  
  src = src.replace(
    /(\brouter\.\w+\([^;]*?,\s*)(?!async\s*)(function\s*\(req,\s*res)/g,
    '$1async $2'
  );

  // 4. Fix app.get/post/use non-async handlers
  src = src.replace(
    /(\bapp\.\w+\([^;]*?,\s*)(?!async\s*)(\(req,\s*res(?:,\s*next)?\)\s*=>)/g,
    '$1async $2'
  );

  // 5. Remove accidental double async
  src = src.replace(/\basync\s+async\b/g, 'async');

  // 6. Fix .get().property -> need to chain properly (e.g. .get().c -> (await .get())?.c)
  //    These are already split across lines so usually fine, but fix inline ones:
  src = src.replace(/\(await db\.prepare\([^)]+\)\.get\([^)]*\)\)\.(\w+)/g, 
    (m, prop) => m.replace(/\(\(await/, '(await').replace(/\)\)\./, ')?.'));

  if (src !== original) {
    fs.writeFileSync(file, src, 'utf8');
    totalFixed++;
    console.log('Updated:', file);
  }
}
console.log(`\nDone. Updated ${totalFixed} files.`);