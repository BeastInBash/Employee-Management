import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended";

// Every controller/middleware does `new PrismaClient()` of its own. We replace
// the constructor so they all share one deep mock that tests can program.
// The real module is preserved for the generated enums (UserRole, TaskStatus,
// …) and the `Prisma` namespace (PrismaClientKnownRequestError) the code uses.
jest.mock("@prisma/client", () => {
  const actual = jest.requireActual("@prisma/client");
  return {
    __esModule: true,
    ...actual,
    PrismaClient: jest.fn(() => prismaMock),
  };
});

// nodemailer must never reach the network during tests.
jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({
      sendMail: jest.fn().mockResolvedValue({ messageId: "test" }),
    })),
  },
}));

// Mock the email util so controllers don't try to send mail and tests can
// assert/override per case (e.g. simulate a mail outage).
jest.mock("../src/utils/email", () => ({
  __esModule: true,
  sendMemberCredentials: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

// Mock bcrypt-backed password util so tests can drive compare results without
// needing real hashes. comparePassword defaults to false (deny) per test.
jest.mock("../src/utils/password", () => ({
  __esModule: true,
  DEFAULT_PASSWORD: "123456",
  hashPassword: jest.fn(async (p: string) => `hashed:${p}`),
  comparePassword: jest.fn(async () => false),
}));

export const prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;

// The controllers log heavily (including expected, handled errors). Silence the
// noise so test output stays readable; set TEST_LOGS=1 to see it again.
beforeEach(() => {
  mockReset(prismaMock);
  // Re-applied each test so it survives suites that call restoreAllMocks().
  if (!process.env.TEST_LOGS) {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  }
});
