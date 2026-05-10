import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Server } from "node:http";
import { exchangeToken, fetchAccountInfo } from "../http.js";

interface Fixture {
  close: () => void;
  url: string;
  readonly lastBody: string;
  readonly hits: number;
}

describe("exchangeToken", () => {
  let server: Fixture;
  let raw: Server;

  beforeEach(async () => {
    const http = await import("node:http");
    let lastBody = "";
    let hits = 0;
    const s = http.createServer((req, res) => {
      hits++;
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        lastBody = Buffer.concat(chunks).toString("utf8");
        if (req.url === "/fail500") { res.statusCode = 500; res.end("nope"); return; }
        if (req.url === "/fail400") {
          res.statusCode = 400;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "invalid_grant" }));
          return;
        }
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ access_token: "x", expires_in: 60 }));
      });
    });
    raw = s;
    await new Promise<void>((r) => s.listen(0, r));
    const port = (s.address() as { port: number }).port;
    server = {
      close: () => s.close(),
      url: `http://127.0.0.1:${port}`,
      get lastBody() { return lastBody; },
      get hits() { return hits; },
    };
  });

  afterEach(() => server.close());

  it("posts form body and parses json response", async () => {
    const res = await exchangeToken({
      url: `${server.url}/ok`,
      params: { grant_type: "authorization_code", code: "abc" },
      authMethod: "post",
      responseFormat: "json",
      clientId: "cid",
      clientSecret: "csec",
    });
    expect(res).toMatchObject({ access_token: "x" });
    expect(server.lastBody).toContain("grant_type=authorization_code");
    expect(server.lastBody).toContain("client_id=cid");
  });

  it("retries on 5xx", async () => {
    await expect(
      exchangeToken({
        url: `${server.url}/fail500`,
        params: { grant_type: "authorization_code", code: "abc" },
        authMethod: "post",
        responseFormat: "json",
        clientId: "cid",
        clientSecret: "csec",
      }),
    ).rejects.toThrow();
    // 1 initial + 2 retries = 3 attempts
    expect(server.hits).toBe(3);
  });

  it("does not retry on 4xx", async () => {
    await expect(
      exchangeToken({
        url: `${server.url}/fail400`,
        params: { grant_type: "authorization_code", code: "abc" },
        authMethod: "post",
        responseFormat: "json",
        clientId: "cid",
        clientSecret: "csec",
      }),
    ).rejects.toThrow(/invalid_grant/);
    expect(server.hits).toBe(1);
  });
});

describe("fetchAccountInfo", () => {
  let server: Fixture;

  beforeEach(async () => {
    const http = await import("node:http");
    let lastAuth = "";
    let hits = 0;
    const s = http.createServer((req, res) => {
      hits++;
      lastAuth = String(req.headers.authorization ?? "");
      if (req.url === "/bad") {
        res.statusCode = 401;
        res.end("unauthorized");
        return;
      }
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: "u1", auth: lastAuth }));
    });
    await new Promise<void>((r) => s.listen(0, r));
    const port = (s.address() as { port: number }).port;
    server = {
      close: () => s.close(),
      url: `http://127.0.0.1:${port}`,
      get lastBody() { return lastAuth; },
      get hits() { return hits; },
    };
  });

  afterEach(() => server.close());

  it("sends Bearer token and returns parsed JSON", async () => {
    const res = await fetchAccountInfo(`${server.url}/me`, "TOKEN");
    expect(res).toMatchObject({ id: "u1", auth: "Bearer TOKEN" });
  });

  it("throws on non-2xx", async () => {
    await expect(fetchAccountInfo(`${server.url}/bad`, "TOKEN")).rejects.toThrow(/401/);
  });
});
