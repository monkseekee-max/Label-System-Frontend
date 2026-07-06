import { useAuthStore } from "#src/store/auth";

import { useUserStore } from "#src/store/user";
/**
 * ADR-019 P3-1/P3-3/P3-4: lifecycle / alias / context API 客户端契约测试
 *
 * 验证 factory-client.ts 新增 10 个方法的字段映射 (真实后端信封 → 前端类型):
 *
 * Lifecycle (P3-1):
 *   - registerModelVersion:  POST /api/v1/lora/versions/{tag}/register   → {state}
 *   - getModelLifecycle:     GET  /api/v1/lora/versions/{tag}/lifecycle  → {versionTag, state, operations}
 *   - promoteModelVersion:   POST /api/v1/lora/versions/{tag}/promote    → {state:"prod"}
 *   - archiveModelVersion:   POST /api/v1/lora/versions/{tag}/archive    → {state:"archived"}
 *   - discardModelVersion:   POST /api/v1/lora/versions/{tag}/discard    → {state:"discarded"}
 *
 * Alias (P3-3):
 *   - setModelAlias:         PUT  /api/v1/lora/aliases/{alias}           → {versionTag}
 *   - getModelAlias:         GET  /api/v1/lora/aliases?...               → string version_tag
 *   - setCanaryRatio:        PUT  /api/v1/lora/aliases/canary/ratio      → {canaryRatio}
 *   - rollbackModelAlias:    POST /api/v1/lora/aliases/rollback          → {version_tag}
 *
 * Context (P3-4):
 *   - getModelContext:       GET  /api/v1/lora/versions/{tag}/context    → ModelContextReport
 *
 * 策略: mock fetch 返回后端信封 {code, message, data} → 调用前端函数 → 断言字段映射.
 *
 * 这些函数是操作性 API (mutating/state-query), 按 ADR-019 P0-1 禁止 mock fallback,
 * 因此不测 fallback 路径, 只测真实后端字段映射.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("factory lifecycle/alias/context 映射", () => {
	const originalFetch = globalThis.fetch;
	let fetchCalls: { url: string, method: string, body?: unknown }[] = [];

	beforeEach(() => {
		vi.stubEnv("VITE_LLM_FACTORY_BASE_URL", "http://test:9090");
		// P0-1: factoryApi 鉴权走登录态 JWT (不再用 env API key)
		useAuthStore.setState({ token: "jwt-test-token", refreshToken: "" });
		useUserStore.setState({ companyId: undefined });
		fetchCalls = [];
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.unstubAllEnvs();
	});

	/** mock fetch 返回后端信封 {code, message, data}; 记录调用以便断言 URL/method/body */
	function mockFetchEnvelope(data: unknown) {
		globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === "string" ? input : input.toString();
			const method = (init?.method || "GET").toUpperCase();
			let body: unknown;
			if (init?.body) {
				try {
					body = JSON.parse(init.body as string);
				}
				catch {
					body = init.body;
				}
			}
			fetchCalls.push({ url, method, body });
			return new Response(JSON.stringify({ code: 200, message: "ok", data }), { status: 200 });
		}) as any;
	}

	// ============================================================
	// Lifecycle (P3-1)
	// ============================================================

	it("registerModelVersion: POST register → {state:'training'}", async () => {
		mockFetchEnvelope({ version_tag: "lc_v1", state: "training", company_id: 1, model_family: "qwen3-8b" });
		const { registerModelVersion } = await import("#src/api/llm-factory");
		const res = await registerModelVersion("lc_v1", { companyId: 1, modelFamily: "qwen3-8b" });
		expect(res.state).toBe("training");
		expect(fetchCalls).toHaveLength(1);
		expect(fetchCalls[0].method).toBe("POST");
		expect(fetchCalls[0].url).toContain("/api/v1/lora/versions/lc_v1/register");
		expect(fetchCalls[0].body).toMatchObject({ company_id: 1, model_family: "qwen3-8b" });
	});

	it("getModelLifecycle: GET lifecycle → {versionTag, state, operations}", async () => {
		mockFetchEnvelope({
			versionTag: "lc_v1",
			state: "prod",
			operations: [
				{ action: "register", fromState: null, toState: "training", actor: null, reason: null, gateDecision: null, createdAt: "2026-06-17T10:00:00Z" },
				{ action: "promote_to_prod", fromState: "staging", toState: "prod", actor: "admin", reason: null, gateDecision: "pass", createdAt: "2026-06-17T11:00:00Z" },
			],
		});
		const { getModelLifecycle } = await import("#src/api/llm-factory");
		const res = await getModelLifecycle("lc_v1");
		expect(res.versionTag).toBe("lc_v1");
		expect(res.state).toBe("prod");
		expect(res.operations).toHaveLength(2);
		expect(res.operations[1].action).toBe("promote_to_prod");
		expect(res.operations[1].actor).toBe("admin");
		expect(fetchCalls[0].method).toBe("GET");
		expect(fetchCalls[0].url).toContain("/api/v1/lora/versions/lc_v1/lifecycle");
	});

	it("promoteModelVersion: POST promote → {state:'prod'}", async () => {
		mockFetchEnvelope({ version_tag: "lc_v2", state: "prod", company_id: 1, model_family: "qwen3-8b" });
		const { promoteModelVersion } = await import("#src/api/llm-factory");
		const res = await promoteModelVersion("lc_v2", "pass", { actor: "admin" });
		expect(res.state).toBe("prod");
		expect(fetchCalls[0].method).toBe("POST");
		expect(fetchCalls[0].url).toContain("/api/v1/lora/versions/lc_v2/promote");
		expect(fetchCalls[0].body).toMatchObject({ gate_decision: "pass", actor: "admin" });
	});

	it("archiveModelVersion: POST archive → {state:'archived'}", async () => {
		mockFetchEnvelope({ version_tag: "lc_v3", state: "archived" });
		const { archiveModelVersion } = await import("#src/api/llm-factory");
		const res = await archiveModelVersion("lc_v3", { reason: "已过时" });
		expect(res.state).toBe("archived");
		expect(fetchCalls[0].method).toBe("POST");
		expect(fetchCalls[0].url).toContain("/api/v1/lora/versions/lc_v3/archive");
		expect(fetchCalls[0].body).toMatchObject({ reason: "已过时" });
	});

	it("discardModelVersion: POST discard → {state:'discarded'}", async () => {
		mockFetchEnvelope({ version_tag: "lc_v4", state: "discarded" });
		const { discardModelVersion } = await import("#src/api/llm-factory");
		const res = await discardModelVersion("lc_v4", { actor: "admin", reason: "训练失败" });
		expect(res.state).toBe("discarded");
		expect(fetchCalls[0].method).toBe("POST");
		expect(fetchCalls[0].url).toContain("/api/v1/lora/versions/lc_v4/discard");
		expect(fetchCalls[0].body).toMatchObject({ actor: "admin", reason: "训练失败" });
	});

	// ============================================================
	// Alias (P3-3)
	// ============================================================

	it("setModelAlias: PUT aliases/{alias} → {versionTag}", async () => {
		mockFetchEnvelope({ versionTag: "al_v1", company_id: 1, model_family: "qwen3-8b", alias: "prod" });
		const { setModelAlias } = await import("#src/api/llm-factory");
		const res = await setModelAlias("prod", { companyId: 1, modelFamily: "qwen3-8b", versionTag: "al_v1" });
		expect(res.versionTag).toBe("al_v1");
		expect(fetchCalls[0].method).toBe("PUT");
		expect(fetchCalls[0].url).toContain("/api/v1/lora/aliases/prod");
		expect(fetchCalls[0].body).toMatchObject({ company_id: 1, model_family: "qwen3-8b", version_tag: "al_v1" });
	});

	it("getModelAlias: GET aliases?query → 返回 string version_tag", async () => {
		// 后端 ok(version_tag) — data 字段直接是字符串
		mockFetchEnvelope("al_v1");
		const { getModelAlias } = await import("#src/api/llm-factory");
		const res = await getModelAlias(1, "qwen3-8b", "prod");
		expect(res).toBe("al_v1");
		expect(fetchCalls[0].method).toBe("GET");
		expect(fetchCalls[0].url).toContain("/api/v1/lora/aliases");
		expect(fetchCalls[0].url).toContain("company_id=1");
		expect(fetchCalls[0].url).toContain("model_family=qwen3-8b");
		expect(fetchCalls[0].url).toContain("alias=prod");
	});

	it("setCanaryRatio: PUT aliases/canary/ratio → {canaryRatio:0.2}", async () => {
		mockFetchEnvelope({ company_id: 1, model_family: "qwen3-8b", canaryRatio: 0.2 });
		const { setCanaryRatio } = await import("#src/api/llm-factory");
		const res = await setCanaryRatio({ companyId: 1, modelFamily: "qwen3-8b", ratio: 0.2 });
		expect(res.canaryRatio).toBe(0.2);
		expect(fetchCalls[0].method).toBe("PUT");
		expect(fetchCalls[0].url).toContain("/api/v1/lora/aliases/canary/ratio");
		expect(fetchCalls[0].body).toMatchObject({ company_id: 1, model_family: "qwen3-8b", ratio: 0.2 });
	});

	it("rollbackModelAlias: POST aliases/rollback → {version_tag}", async () => {
		// 后端保留 snake_case 字段名 (与 lifecycle 不同), 直接透传
		mockFetchEnvelope({ version_tag: "rb_v1", company_id: 1, model_family: "qwen3-8b" });
		const { rollbackModelAlias } = await import("#src/api/llm-factory");
		const res = await rollbackModelAlias({ companyId: 1, modelFamily: "qwen3-8b" });
		expect(res.version_tag).toBe("rb_v1");
		expect(fetchCalls[0].method).toBe("POST");
		expect(fetchCalls[0].url).toContain("/api/v1/lora/aliases/rollback");
		expect(fetchCalls[0].body).toMatchObject({ company_id: 1, model_family: "qwen3-8b" });
	});

	// ============================================================
	// Context (P3-4)
	// ============================================================

	it("getModelContext: GET versions/{tag}/context → ModelContextReport", async () => {
		mockFetchEnvelope({
			modelTag: "ctx_v1",
			lifecycle: { state: "prod", companyId: 1, modelFamily: "qwen3-8b" },
			operations: [
				{ action: "register", fromState: null, toState: "training", actor: null, reason: null, gateDecision: null, createdAt: "2026-06-17T10:00:00Z" },
			],
			lineage: {
				training_run_id: "run-001",
				dataset_version_tag: "ds_v3",
				dataset_fingerprint: "sha256:abc",
				annotation_count: 12458,
				storage_key: "runs/run-001/",
			},
			eval: {
				scores: { accuracy: 0.825 },
				gate_decision: "pass",
				gate_reason: "all metrics above threshold",
				evaluated_at: "2026-06-17T12:00:00Z",
				storage_key: "eval/job-001/",
			},
		});
		const { getModelContext } = await import("#src/api/llm-factory");
		const res = await getModelContext("ctx_v1");
		expect(res.modelTag).toBe("ctx_v1");
		expect(res.lifecycle.state).toBe("prod");
		expect(res.lifecycle.modelFamily).toBe("qwen3-8b");
		expect(res.operations).toHaveLength(1);
		expect(res.lineage?.dataset_version_tag).toBe("ds_v3");
		expect(res.lineage?.annotation_count).toBe(12458);
		expect(res.eval?.gate_decision).toBe("pass");
		expect(res.eval?.scores.accuracy).toBe(0.825);
		expect(fetchCalls[0].method).toBe("GET");
		expect(fetchCalls[0].url).toContain("/api/v1/lora/versions/ctx_v1/context");
	});
});
