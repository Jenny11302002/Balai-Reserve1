/**
 * Xianfire Template Engine
 *
 * Processes .xian template files with EJS-compatible syntax:
 *   <%= expr %>           — HTML-escaped output
 *   <%- expr %>           — raw/unescaped output
 *   <% code %>            — JavaScript code block
 *   <%# comment %>        — template comment (not rendered)
 *   <%include('path') %>  — include another .xian partial
 *
 * Layouts:
 *   <%- layout('layouts/main') %>  at the top of a view
 *   Inside the layout use  <%- body %>  to inject the view content.
 *
 * All res.locals are accessed inside templates via the `locals` object,
 * but also exposed as direct variable names where the key is a valid
 * JS identifier. Functions (helpers) are always available by name.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── HTML Escape ───────────────────────────────────────────────────────────────

const escapeMap = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;',
  '"': '&quot;', "'": '&#x27;', '`': '&#x60;',
};

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"'`]/g, ch => escapeMap[ch]);
}

// ── Template Cache ────────────────────────────────────────────────────────────

const cache = {};

// ── Compile .xian → JS function body string ──────────────────────────────────

function compile(templateStr) {
  // Note: do NOT add "use strict" here — with() blocks are incompatible with strict mode
  let code = 'let __out = "";\n';

  const tagRe = /<%([#=\-]?)([\s\S]*?)%>/g;
  let lastIndex = 0;
  let match;

  while ((match = tagRe.exec(templateStr)) !== null) {
    const before = templateStr.slice(lastIndex, match.index);
    if (before) code += `__out += ${JSON.stringify(before)};\n`;

    const flag    = match[1];
    const content = match[2];

    if (flag === '#') {
      // comment — skip
    } else if (flag === '=') {
      // escaped output
      code += `__out += __escape(${content.trim()});\n`;
    } else if (flag === '-') {
      // raw output
      const expr = content.trim();
      // Special: layout() directive — already stripped before compile, but
      // guard it here so it never emits to output
      if (/^layout\s*\(/.test(expr)) {
        // do nothing
      } else {
        code += `__out += (${expr}) == null ? '' : (${expr});\n`;
      }
    } else {
      // code block
      const trimmed = content.trim();
      if (/^include\s*\(/.test(trimmed)) {
        // include('partials/foo')  →  __include('partials/foo', __locals)
        const innerArgs = trimmed.slice(trimmed.indexOf('(') + 1, trimmed.lastIndexOf(')'));
        code += `__out += __include(${innerArgs}, __locals);\n`;
      } else {
        code += trimmed + '\n';
      }
    }

    lastIndex = tagRe.lastIndex;
  }

  const tail = templateStr.slice(lastIndex);
  if (tail) code += `__out += ${JSON.stringify(tail)};\n`;
  code += 'return __out;\n';
  return code;
}

// ── Build a safe locals proxy for the template scope ─────────────────────────
//
// Instead of spreading every local as a named parameter (which breaks when
// a key is not a valid identifier, or when a value's .toString() contains
// modern syntax like ??, ?., etc.), we compile a with-block that exposes
// locals safely.  The template function signature is fixed and minimal.

function buildTemplateFunction(code) {
  // `with` allows all locals (including __escape, __include) to be accessed
  // as plain variable names. Cannot be used in strict mode.
  const wrapped = `
return function __xianTemplate(__locals) {
  with (__locals) {
    ${code}
  }
};
`;
  // eslint-disable-next-line no-new-func
  return new Function(wrapped)();
}

// ── Render a template string with locals ─────────────────────────────────────

function renderString(templateStr, locals, viewsRoot, filePath) {
  const code = compile(templateStr);

  let fn;
  try {
    fn = buildTemplateFunction(code);
  } catch (compileErr) {
    throw new Error(
      `[Xianfire] Compile error in "${filePath}":\n${compileErr.message}\n\n--- Generated code ---\n${code}`
    );
  }

  function __include(partialPath, parentLocals) {
    const resolved = resolveTemplatePath(partialPath, viewsRoot);
    const src      = fs.readFileSync(resolved, 'utf8');
    return renderString(src, parentLocals, viewsRoot, resolved);
  }

  // Merge __escape and __include into locals so `with` exposes them too,
  // then pass the same merged object as __locals for explicit access
  const scope = Object.assign(Object.create(null), locals, {
    __escape:  escapeHtml,
    __include,
    __locals:  null,  // placeholder; set below
  });
  scope.__locals = scope;  // self-reference so templates can pass __locals to includes

  try {
    return fn(scope);
  } catch (renderErr) {
    throw new Error(
      `[Xianfire] Render error in "${filePath}":\n${renderErr.message}\n\n--- Generated code ---\n${code}`
    );
  }
}

// ── Resolve template path ─────────────────────────────────────────────────────

function resolveTemplatePath(name, viewsRoot) {
  if (path.isAbsolute(name)) return name;
  const withExt = name.endsWith('.xian') ? name : name + '.xian';
  return path.join(viewsRoot, withExt);
}

// ── Main render entry point (called by Express) ───────────────────────────────

function render(filePath, locals, callback) {
  const viewsRoot = (locals.settings && locals.settings.views)
    ? locals.settings.views
    : path.dirname(filePath);

  try {
    const useCache = process.env.NODE_ENV === 'production';
    let templateStr;

    if (useCache && cache[filePath]) {
      templateStr = cache[filePath];
    } else {
      templateStr = fs.readFileSync(filePath, 'utf8');
      if (useCache) cache[filePath] = templateStr;
    }

    // Extract layout directive (<%- layout('...') %> or <% layout('...') %>)
    const layoutRe = /<%[-\s]*\s*layout\s*\(\s*['"`](.+?)['"`]\s*\)\s*[-\s]*%>/;
    const layoutMatch = templateStr.match(layoutRe);
    let layoutName = (locals.layout !== undefined) ? locals.layout : null;

    if (layoutMatch) {
      layoutName   = layoutMatch[1];
      templateStr  = templateStr.replace(layoutMatch[0], '');
    }

    const body = renderString(templateStr, locals, viewsRoot, filePath);

    if (layoutName) {
      const layoutPath = resolveTemplatePath(layoutName, viewsRoot);
      let layoutStr    = fs.readFileSync(layoutPath, 'utf8');
      // Strip any layout() directive inside the layout itself
      layoutStr = layoutStr.replace(layoutRe, '');
      const fullHtml = renderString(layoutStr, Object.assign({}, locals, { body }), viewsRoot, layoutPath);
      return callback(null, fullHtml);
    }

    return callback(null, body);
  } catch (err) {
    return callback(err);
  }
}

// ── Register with Express ─────────────────────────────────────────────────────

function register(app, options = {}) {
  const viewsDir = options.viewsDir || path.join(process.cwd(), 'views');
  app.engine('xian', render);
  app.set('view engine', 'xian');
  app.set('views', viewsDir);
  app.locals.escape = escapeHtml;
}

module.exports = { render, register, escapeHtml, compile };
