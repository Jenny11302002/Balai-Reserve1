/**
 * Automated SQLite to Postgres Conversion
 * Converts all route files to use Postgres-compatible SQL
 */

const fs = require('fs');
const path = require('path');

function findAllRouteFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findAllRouteFiles(filePath, fileList);
    } else if (file.endsWith('.js') && filePath.includes('routes')) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

function convertFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const original = content;
  
  // Convert SQLite DATE() function to Postgres CAST
  if (content.includes('DATE(')) {
    content = content.replace(/DATE\(([^)]+)\)/g, 'CAST($1 AS DATE)');
    modified = true;
  }
  
  // Convert strftime to TO_CHAR for date formatting
  if (content.includes('strftime')) {
    content = content.replace(/strftime\('%Y-%m',\s*([^)]+)\)/g, "TO_CHAR($1, 'YYYY-MM')");
    content = content.replace(/strftime\('%Y-%m-%d',\s*([^)]+)\)/g, "TO_CHAR($1, 'YYYY-MM-DD')");
    modified = true;
  }
  
  // Convert datetime('now') to NOW()
  if (content.includes("datetime('now')")) {
    content = content.replace(/datetime\('now'\)/g, 'NOW()');
    modified = true;
  }
  
  // Convert date('now') to CURRENT_DATE
  if (content.includes("date('now')")) {
    content = content.replace(/date\('now'[^)]*\)/g, 'CURRENT_DATE');
    modified = true;
  }
  
  // Convert string concatenation || to CONCAT for complex cases
  // But keep simple cases as-is since Postgres supports ||
  
  // Make sure all db.prepare() calls use await
  const prepareRegex = /(?<!await\s)(?<!await\s\s)db\.prepare\(/g;
  if (prepareRegex.test(content)) {
    content = content.replace(prepareRegex, 'await db.prepare(');
    modified = true;
  }
  
  // Ensure route handlers are async if they use await
  if (content.includes('await') && /router\.(get|post|put|delete|patch)\([^,]+,\s*(?!async)\(/.test(content)) {
    content = content.replace(
      /router\.(get|post|put|delete|patch)\(([^,]+),\s*\(req,\s*res/g,
      'router.$1($2, async (req, res'
    );
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${path.relative(process.cwd(), filePath)}`);
    return true;
  }
  
  return false;
}

console.log('🔄 Converting all routes to Postgres...\n');

const srcDir = path.join(__dirname, '..', 'src');
const files = findAllRouteFiles(srcDir);

console.log(`Found ${files.length} route files\n`);

let converted = 0;
for (const file of files) {
  if (convertFile(file)) {
    converted++;
  }
}

console.log(`\n✅ Converted ${converted} files to Postgres compatibility`);
