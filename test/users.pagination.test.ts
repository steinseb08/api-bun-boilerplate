import { describe, expect, test } from "bun:test";
import { ListUsersQuerySchema } from "../src/request/users";
import { decodeUsersCursor, encodeUsersCursor } from "../src/utils/pagination";

describe("ListUsersQuerySchema", () => {
  test("accepts offset mode", () => {
    const value = ListUsersQuerySchema.parse({
      limit: "20",
      offset: "10",
    });

    expect(value.limit).toBe(20);
    expect(value.offset).toBe(10);
    expect(value.cursor).toBeUndefined();
  });

  test("accepts cursor mode", () => {
    const value = ListUsersQuerySchema.parse({
      limit: "15",
      cursor: "abc123",
    });

    expect(value.limit).toBe(15);
    expect(value.cursor).toBe("abc123");
    expect(value.offset).toBeUndefined();
  });

  test("rejects mixed offset and cursor", () => {
    expect(() =>
      ListUsersQuerySchema.parse({
        limit: 20,
        offset: 0,
        cursor: "abc123",
      }),
    ).toThrow();
  });
});

describe("users cursor helpers", () => {
  test("encodes and decodes cursor", () => {
    const encoded = encodeUsersCursor({
      createdAt: "2026-03-12T07:00:00.000Z",
      id: "2f36a63f-48c4-4dd8-9f82-6e40ef2ab6f3",
    });

    const decoded = decodeUsersCursor(encoded);

    expect(decoded.createdAt).toBe("2026-03-12T07:00:00.000Z");
    expect(decoded.id).toBe("2f36a63f-48c4-4dd8-9f82-6e40ef2ab6f3");
  });

  test("rejects invalid cursor", () => {
    expect(() => decodeUsersCursor("not-a-valid-cursor")).toThrow();
  });
});
