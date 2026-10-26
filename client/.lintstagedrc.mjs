// Runs on staged client files (paths are absolute; tasks run in client/).
export default {
  "*.{ts,tsx}": [
    "eslint --fix --max-warnings=0 --no-warn-ignored",
    "prettier --write",
    // Whole-project type-check, once, however many files are staged.
    () => "tsc -b",
  ],
  "*.{js,mjs,cjs,json,css,html}": "prettier --write",
};
