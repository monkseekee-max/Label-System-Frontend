import { useAuthStore } from "#src/store/auth";

import { useUserStore } from "#src/store/user";
/**
 * 去 mock 映射测试 (全量去 mock Phase)
 *
 * 验证 index.ts 的 5 个原纯 mock 函数, 真实后端路径的字段映射正确:
 * - fetchPipelineRunList: /data/batches → DataPipelineRun (source 大写, status 映射)
 * - fetchMediaAssetList:  /media → MediaAsset (完整字段)
 * - fetchTrainingJobDetail: /tasks/{id} → TrainingJob (status/gate/progress 映射)
 *
 * 策略: mock fetch 返回后端信封 → withFallback 走真实路径 → 断言映射输出.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("factory 去 mock 映射", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.stubEnv("VITE_LLM_FACTORY_BASE_URL", "http://test:9090");
		// P0-1: factoryApi 鉴权走登录态 JWT (不再用 env API key)
		useAuthStore.setState({ token: "jwt-test-token", refreshToken: "" });
		useUserStore.setState({ companyId: undefined });
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.unstubAllEnvs();
	});

	/** mock fetch 返回后端信封 {code, message, data} */
	function mockFetch(data: unknown) {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ code: 200, message: "ok", data }), { status: 200 }),
		) as any;
	}

	/** mock fetch 返回原始 body (无信封, 旧端点 /media /tasks/{id}) */
	function mockFetchRaw(data: unknown) {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify(data), { status: 200 }),
		) as any;
	}

	// ============================================================
	// fetchPipelineRunList
	// ============================================================
	it("fetchPipelineRunList: batches → DataPipelineRun (source 大写, status 透传)", async () => {
		mockFetch({
			records: [
				{ batchId: "b1", source: "api", recordCount: 1247, imported: 1247, duplicates: 0, errors: 0, status: "COMPLETED", createdAt: "2026-06-15T10:00:00Z" },
				{ batchId: "b2", source: "upload", recordCount: 560, imported: 500, duplicates: 0, errors: 60, status: "PARTIAL_FAILED", createdAt: "2026-06-14T10:00:00Z" },
			],
			total: 2,
		});
		const { fetchPipelineRunList } = await import("#src/api/llm-factory");
		const res = await fetchPipelineRunList({ pageNo: 1, pageSize: 10 });
		expect(res.success).toBe(true);
		const records = res.result!.records;
		expect(records).toHaveLength(2);
		// source 大写映射
		expect(records[0]).toMatchObject({ id: "b1", source: "API", recordCount: 1247, status: "COMPLETED", completedAt: "2026-06-15T10:00:00Z" });
		expect(records[1]).toMatchObject({ id: "b2", source: "UPLOAD", status: "PARTIAL_FAILED" });
	});

	// ============================================================
	// fetchMediaAssetList
	// ============================================================
	it("fetchMediaAssetList: media → MediaAsset (完整字段映射)", async () => {
		mockFetchRaw({
			total: 1,
			items: [{
				media_id: "img_1",
				media_type: "image",
				file_path: "/x.png",
				file_size: 1024,
				task_type: "IMAGE_CAPTION",
				mime_type: "image/png",
				width: 100,
				height: 200,
				duration: null,
				checksum_sha256: "abc123",
				created_at: "2026-06-15T00:00:00Z",
			}],
		});
		const { fetchMediaAssetList } = await import("#src/api/llm-factory");
		const res = await fetchMediaAssetList({ pageNo: 1, pageSize: 20 });
		expect(res.success).toBe(true);
		const r = res.result!.records[0];
		expect(r).toMatchObject({
			mediaId: "img_1",
			type: "image",
			filePath: "/x.png",
			fileSize: 1024,
			mimeType: "image/png",
			width: 100,
			height: 200,
			taskCategory: "IMAGE_CAPTION",
			sha256: "abc123",
			uploadedAt: "2026-06-15T00:00:00Z",
		});
	});

	it("fetchMediaAssetList: video 含 duration", async () => {
		mockFetchRaw({
			total: 1,
			items: [{
				media_id: "vid_1",
				media_type: "video",
				file_path: "/v.mp4",
				file_size: 5000,
				task_type: "VIDEO_QA",
				mime_type: "video/mp4",
				width: null,
				height: null,
				duration: 135,
				checksum_sha256: "def",
				created_at: "2026-06-14T00:00:00Z",
			}],
		});
		const { fetchMediaAssetList } = await import("#src/api/llm-factory");
		const r = (await fetchMediaAssetList()).result!.records[0];
		expect(r).toMatchObject({ type: "video", duration: 135 });
	});

	// ============================================================
	// fetchTrainingJobDetail
	// ============================================================
	it("fetchTrainingJobDetail: running 任务映射 (status/progress/duration)", async () => {
		mockFetchRaw({
			task_id: "run-001",
			task_type: "training",
			trigger_mode: "semi_auto",
			status: "running",
			started_at: "2026-06-15T09:00:00Z",
			completed_at: null,
			duration_seconds: 1800,
			exit_code: null,
			error: null,
			log_lines: 10,
			pipeline_progress: { stage: "sft", steps_completed: 4, steps_total: 7 },
			gate: { passed: null, reason: "pending" },
			metadata: { model_key: "qwen3-8b", lora_rank: 16, data_size: 5000 },
		});
		const { fetchTrainingJobDetail } = await import("#src/api/llm-factory");
		const job = (await fetchTrainingJobDetail("run-001")).result!;
		expect(job.runId).toBe("run-001");
		expect(job.status).toBe("RUNNING");
		expect(job.triggerMode).toBe("SEMI_AUTO");
		expect(job.baseModel).toBe("qwen3-8b");
		expect(job.loraConfig).toBe("Rank=16");
		expect(job.dataSize).toBe(5000);
		expect(job.pipelineProgress).toBe(4); // round(4/7*7)
		expect(job.duration).toBe(30); // 1800s / 60
		expect(job.gateResult).toBe("PASS"); // passed=null → 默认 PASS
	});

	it("fetchTrainingJobDetail: cancelled + gate 失败 → FAILED/FAIL", async () => {
		mockFetchRaw({
			task_id: "run-002",
			task_type: "training",
			trigger_mode: "manual",
			status: "cancelled",
			started_at: null,
			completed_at: "2026-06-15T00:00:00Z",
			duration_seconds: 0,
			exit_code: 1,
			error: "oom",
			log_lines: 5,
			pipeline_progress: { stage: "done", steps_completed: 3, steps_total: 7 },
			gate: { passed: false, reason: "regression" },
			metadata: { model_key: "qwen3.5-4b", lora_rank: 8 },
		});
		const { fetchTrainingJobDetail } = await import("#src/api/llm-factory");
		const job = (await fetchTrainingJobDetail("run-002")).result!;
		expect(job.status).toBe("FAILED");
		expect(job.gateResult).toBe("FAIL");
		expect(job.gateReason).toBe("regression"); // P3-2: reason 透传
		expect(job.completedAt).toBe("2026-06-15T00:00:00Z");
	});

	it("fetchTrainingJobDetail: gate reason 详细文案透传 (P3-2)", async () => {
		mockFetchRaw({
			task_id: "run-gate-detail",
			task_type: "training",
			trigger_mode: "manual",
			status: "completed",
			started_at: null,
			completed_at: "2026-06-15T00:00:00Z",
			duration_seconds: 600,
			exit_code: 0,
			error: null,
			log_lines: 50,
			pipeline_progress: { stage: "done", steps_completed: 7, steps_total: 7 },
			gate: { passed: false, reason: "f1_score regression > 5% vs baseline" },
			metadata: { model_key: "qwen3-8b" },
		});
		const { fetchTrainingJobDetail } = await import("#src/api/llm-factory");
		const job = (await fetchTrainingJobDetail("run-gate-detail")).result!;
		expect(job.gateResult).toBe("FAIL");
		expect(job.gateReason).toBe("f1_score regression > 5% vs baseline");
	});

	it("fetchTrainingJobDetail: queued 任务 → PENDING", async () => {
		mockFetchRaw({
			task_id: "run-003",
			task_type: "training",
			trigger_mode: "auto",
			status: "queued",
			started_at: null,
			completed_at: null,
			duration_seconds: null,
			exit_code: null,
			error: null,
			log_lines: 0,
			pipeline_progress: { stage: "queued", steps_completed: 0, steps_total: 0 },
			gate: { passed: null, reason: "pending" },
			metadata: {},
		});
		const { fetchTrainingJobDetail } = await import("#src/api/llm-factory");
		const job = (await fetchTrainingJobDetail("run-003")).result!;
		expect(job.status).toBe("PENDING");
		expect(job.pipelineProgress).toBe(0);
	});
});
