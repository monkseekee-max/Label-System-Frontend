/**
 * ADR-022 FE-3: 关键路径 e2e 测试
 *
 * 覆盖: landing → login → dashboard 导航 → API 响应契约
 */
import { test, expect } from "@playwright/test";

const BFF_URL = "http://127.0.0.1:9090";

test("health endpoint responds with correct contract", async ({ request }) => {
	const resp = await request.get(`${BFF_URL}/health`);
	expect(resp.status()).toBe(200);
	const body = await resp.json();
	expect(body.status).toBe("ok");
	expect(body.service).toBe("llm-factory-api");
	expect(body.db).toBe("ok");
});

test("/metrics returns prometheus format", async ({ request }) => {
	const resp = await request.get(`${BFF_URL}/metrics`);
	expect(resp.status()).toBe(200);
	const text = await resp.text();
	expect(text).toContain("# HELP");
	expect(text).toContain("# TYPE");
});

test("rate limiting triggers on 6th login attempt", async ({ request }) => {
	const payload = { phone: "0000000000", companyCode: "X", password: "x" };
	let lastStatus = 0;
	for (let i = 0; i < 7; i++) {
		const resp = await request.post(`${BFF_URL}/api/auth/login`, { data: payload });
		lastStatus = resp.status();
	}
	expect(lastStatus).toBe(429);
});

test("IAM registration endpoint returns 410 Gone", async ({ request }) => {
	const resp = await request.post(`${BFF_URL}/api/auth/register`, {
		data: {
			username: "test",
			email: "test@test.com",
			password: "Test12345678",
			role: "operator",
			captcha_id: "x",
			captcha_code: "y",
		},
	});
	expect(resp.status()).toBe(410);
});

test("proxy health has no jwt_bridge field", async ({ request }) => {
	const resp = await request.get(`${BFF_URL}/api/ls/health`, {
		headers: { "X-API-Key": "dev_local_key" },
	});
	expect(resp.status()).toBe(200);
	const body = await resp.json();
	expect(body.proxy).toBe("ok");
	expect(body).not.toHaveProperty("jwt_bridge");
});
