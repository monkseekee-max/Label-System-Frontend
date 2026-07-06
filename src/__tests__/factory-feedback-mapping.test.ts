import { useAuthStore } from "#src/store/auth";

import { useUserStore } from "#src/store/user";
/**
 * ADR-019 P3-5: 线上反馈回流 API 客户端契约测试
 *
 * 验证 factory-client.ts 3 个 feedback 方法的字段映射:
 *   - ingestFeedback:  POST /api/v1/feedback/ingest        → FeedbackSample
 *   - listPendingFeedback: GET /api/v1/feedback/pending    → FeedbackSample[]
 *   - generateFeedbackTasks: POST /api/v1/feedback/generate-tasks → unknown
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("factory feedback 回流映射", () => {
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

	it("ingestFeedback: POST ingest → FeedbackSample", async () => {
		mockFetchEnvelope({
			sample_id: "fb_001",
			source: "low_confidence",
			content: "用户问题: ...",
			model_tag: "lora_v1",
			company_id: 1,
			confidence: 0.32,
			status: "pending",
			created_at: "2026-06-17T10:00:00Z",
		});
		const { ingestFeedback } = await import("#src/api/llm-factory");
		const res = await ingestFeedback({
			source: "low_confidence",
			content: "用户问题: ...",
			modelTag: "lora_v1",
			companyId: 1,
			confidence: 0.32,
		});
		expect(res.sample_id).toBe("fb_001");
		expect(res.source).toBe("low_confidence");
		expect(res.model_tag).toBe("lora_v1");
		expect(res.confidence).toBe(0.32);
		expect(fetchCalls).toHaveLength(1);
		expect(fetchCalls[0].method).toBe("POST");
		expect(fetchCalls[0].url).toContain("/api/v1/feedback/ingest");
		expect(fetchCalls[0].body).toMatchObject({
			source: "low_confidence",
			model_tag: "lora_v1",
			company_id: 1,
			confidence: 0.32,
		});
	});

	it("listPendingFeedback: GET pending → FeedbackSample[]", async () => {
		mockFetchEnvelope([
			{
				sample_id: "fb_001",
				source: "user_correction",
				content: "差评: 答非所问",
				model_tag: "lora_v1",
				company_id: 1,
				confidence: null,
				status: "pending",
				created_at: "2026-06-17T10:00:00Z",
			},
			{
				sample_id: "fb_002",
				source: "eval_failure",
				content: "评测失败样本",
				model_tag: "lora_v2",
				company_id: 1,
				confidence: 0.45,
				status: "pending",
				created_at: "2026-06-17T11:00:00Z",
			},
		]);
		const { listPendingFeedback } = await import("#src/api/llm-factory");
		const res = await listPendingFeedback(1);
		expect(res).toHaveLength(2);
		expect(res[0].sample_id).toBe("fb_001");
		expect(res[0].source).toBe("user_correction");
		expect(res[1].confidence).toBe(0.45);
		expect(fetchCalls[0].method).toBe("GET");
		expect(fetchCalls[0].url).toContain("/api/v1/feedback/pending");
		expect(fetchCalls[0].url).toContain("company_id=1");
	});

	it("generateFeedbackTasks: POST generate-tasks → 结果透传", async () => {
		mockFetchEnvelope({ generated_count: 12, project_id: 5 });
		const { generateFeedbackTasks } = await import("#src/api/llm-factory");
		const res = (await generateFeedbackTasks({ companyId: 1, projectId: 5, maxCount: 20 })) as {
			generated_count: number
			project_id: number
		};
		expect(res.generated_count).toBe(12);
		expect(res.project_id).toBe(5);
		expect(fetchCalls[0].method).toBe("POST");
		expect(fetchCalls[0].url).toContain("/api/v1/feedback/generate-tasks");
		expect(fetchCalls[0].body).toMatchObject({ company_id: 1, project_id: 5, max_count: 20 });
	});
});
