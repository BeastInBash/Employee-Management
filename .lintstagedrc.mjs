// Files outside client/ and backend/ (root config, CI workflows). Each package
// has its own .lintstagedrc.mjs, and lint-staged uses the closest one per file.
export default {
  "*.{js,mjs,cjs,json,yml,yaml}": "prettier --write",
};
