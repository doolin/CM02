const { checkRateLimit, resetRateLimit, MAX_REQUESTS } = require("../lib/rateLimit");

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimit();
  });

  test("allows requests under the limit", () => {
    for (let i = 0; i < MAX_REQUESTS; i++) {
      expect(checkRateLimit("1.2.3.4")).toBe(true);
    }
  });

  test("blocks requests over the limit", () => {
    for (let i = 0; i < MAX_REQUESTS; i++) {
      checkRateLimit("1.2.3.4");
    }
    expect(checkRateLimit("1.2.3.4")).toBe(false);
  });

  test("tracks IPs independently", () => {
    for (let i = 0; i < MAX_REQUESTS; i++) {
      checkRateLimit("1.2.3.4");
    }
    expect(checkRateLimit("1.2.3.4")).toBe(false);
    expect(checkRateLimit("5.6.7.8")).toBe(true);
  });
});
