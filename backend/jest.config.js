/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  // Load the env + Prisma mock before any test module is imported so that every
  // controller's `new PrismaClient()` resolves to the shared deep mock.
  setupFiles: ["<rootDir>/tests/env.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/singleton.ts"],
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  clearMocks: true,
  // ts-node config in the repo is strict; tests don't need the same strictness.
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        diagnostics: { ignoreCodes: [2345, 2322, 2769] },
      },
    ],
  },
};
