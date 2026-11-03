// Installed as scripts/claude-hooks/cyc.mjs in the consuming project.
// Resolve from this file so nested working directories and moved clones work.
// The project's own linter may parse every .mjs file as a classic script, so this file uses no
// import declarations, import.meta, or top-level await: they would be parse errors there, which
// no eslint-disable comment can suppress. The response hook resolves the real project path.
Promise.all([import('node:path'), import('node:url')]).then(function (modules) {
  var path = modules[0];
  var root = path.resolve(path.dirname(process.argv[1]), '../..');
  var engine = path.resolve(root, '.cyc/engine/scripts/response-hook.mjs');
  process.argv = [process.execPath, engine, 'claude', '--project', root];
  return import(modules[1].pathToFileURL(engine).href);
});
