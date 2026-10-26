// Runs on staged backend files (paths are absolute; tasks run in backend/).
export default {
  "*.ts": [
    "eslint --fix --max-warnings=0 --no-warn-ignored",
    "prettier --write",
    // Whole-project type-check, once, however many files are staged.
    () => "tsc --noEmit -p .",
  ],
  "*.{js,mjs,cjs,json}": "prettier --write",
};
