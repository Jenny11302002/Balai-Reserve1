/**
 * Automated Script to Convert Synchronous Database Calls to Async
 * Fixes all route files for Firestore compatibility
 */
'use strict';

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files to process
const routePatterns = [
  'src/modules/**/routes/**/*.js',
  'src/modules/**/routes/*.js',
];

// Patterns to replace
const replacements = [
  // Make route handlers async
  {
    pattern: /router\.(get|post|put|patch|delete)\((['"`][^'"`]+['"`](?:,\s*\w+)*),\s*(?!async\s*)\(req,\s*res(?:,\s*next)?\)\s*=>\s*\{/g,
    replacement: (match, method, route) => {
      return match.replace(/\(req,\s*res(?:,\s*next)?\)\s*=>/, 'async (req, res$1) =>').replace('$1', match.includes('next') ? ', next' : '');
    },
    description: 'Make arrow function route handlers async',
  },
  {
    pattern: /router\.(get|post|put|patch|delete)\((['"`][^'"`]+['"`](?:,\s*\w+)*),\s*(?!async\s*)function\s*\(req,\s*res(?:,\s*next)?\)\s*\{/g,
    replacement: (match) => match.replace('function', 'async function'),
    description: 'Make function route handlers async',
  },
  
  // Add await to .get() calls
  {
    pattern: /(?<!await\s)(?<!await\s\()db\.prepare\([^)]+\)\.get\(/g,
    replacement: 'await db.prepare',
    replace: (match) => match.replace('db.prepare', 'await db.prepare'),
    description: 'Add await to db.prepare().get() calls',
  },
  
  // Add await to .all() calls
  {
    pattern: /(?<!await\s)(?<!await\s\()db\.prepare\([^)]+\)\.all\(/g,
    replacement: 'await db.prepare',
    replace: (match) => match.replace('db.prepare', 'await db.prepare'),
    description: 'Add await to db.prepare().all() calls',
  },
  
  // Add await to .run() calls
  {
    pattern: /(?<!await\s)(?<!await\s\()db\.prepare\([^)]+\)\.run\(/g,
    replacement: 'await db.prepare',
    replace: (match) => match.replace('db.prepare', 'await db.prepare'),
    description: 'Add await to db.prepare().run() calls',
  },

  // Add || [] to .all() results that might be iterated
  {
    pattern: /const\s+(\w+)\s*=\s*await\s+db\.prepare\([^)]+\)\.all\([^)]*\);(?!\s*\|\|\s*\[\])/g,
    replacement: (match, varName) => match.replace(');', ') || [];'),
    description: 'Add || [] fallback to .all() results',
  },

  // Add optional chaining to .get() results
  {
    pattern: /const\s+(\w+)\s*=\s*await\s+db\.prepare\([^)]+\)\.get\([^)]*\);/g,
    replacement: (match) => {
      // Only add ?. if not already present and if accessing properties
      return match;
    },
    description: 'Prepare .get() results for optional chaining',
  },

  // Fix db.transaction() - comment it out with a note
  {
    pattern: /const\s+\w+\s*=\s*db\.transaction\(/g,
    replacement: '// TODO: Firestore doesn\'t support transactions like SQLite\n  // Replace with sequential awaits\n  const TRANSACTION_NOT_SUPPORTED = db.transaction(',
    description: 'Flag db.transaction() for manual review',
  },
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const original = content;

  // Apply each replacement pattern
  for (const { pattern, replacement, replace, description } of replacements) {
    const before = content;
    
    if (replace) {
      content = content.replace(pattern, replace);
    } else if (typeof replacement === 'function') {
      content = content.replace(pattern, replacement);
    } else {
      content = content.replace(pattern, replacement);
    }
    
    if (content !== before) {
      modified = true;
      console.log(`  ✓ ${description}`);
    }
  }

  // Save if modified
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }

  return false;
}

function main() {
  console.log('🔧 Starting automatic async/await conversion...\n');
  
  let totalFiles = 0;
  let modifiedFiles = 0;

  // Find all route files
  const files = [];
  for (const pattern of routePatterns) {
    const matches = glob.sync(pattern, { 
      cwd: process.cwd(),
      absolute: true,
      ignore: ['**/node_modules/**', '**/test/**'],
    });
    files.push(...matches);
  }

  console.log(`Found ${files.length} route files to process\n`);

  // Process each file
  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file);
    console.log(`Processing: ${relativePath}`);
    
    try {
      if (processFile(file)) {
        modifiedFiles++;
        console.log(`  ✅ Modified\n`);
      } else {
        console.log(`  ⏭️  No changes needed\n`);
      }
      totalFiles++;
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}\n`);
    }
  }

  console.log('═══════════════════════════════════════');
  console.log(`Processed: ${totalFiles} files`);
  console.log(`Modified:  ${modifiedFiles} files`);
  console.log('═══════════════════════════════════════\n');
  
  console.log('⚠️  IMPORTANT: Review the changes before committing!');
  console.log('   - Check for db.transaction() usage (flagged with TODO)');
  console.log('   - Verify complex query patterns');
  console.log('   - Test all modified routes\n');
}

if (require.main === module) {
  main();
}

module.exports = { processFile };
