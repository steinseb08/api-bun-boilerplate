import { describe, expect, test } from "bun:test";
import { CreateUserSchema } from "../src/request/users";

describe("CreateUserSchema", () => {
  test("normalizes fullName and lowercases email", () => {
    const value = CreateUserSchema.parse({
      email: "  PERSON@EXAMPLE.COM  ",
      fullName: "  Ada    Lovelace  ",
    });

    expect(value.email).toBe("person@example.com");
    expect(value.fullName).toBe("Ada Lovelace");
  });

  test("rejects invalid email", () => {
    expect(() =>
      CreateUserSchema.parse({
        email: "not-an-email",
        fullName: "Test User",
      }),
    ).toThrow();
  });
});
