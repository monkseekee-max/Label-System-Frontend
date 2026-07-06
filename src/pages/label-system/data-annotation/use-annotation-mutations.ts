// data-annotation 的 mutation 集合
// 包含文本标注闭环 (生成/保存/提交/审核/定稿/上传) + 多模态分析结果落库 (图片区域/视频帧/时间窗)
import type { DataAsset, QAItem, QARunResponse } from "#src/api/label-system";
import type { DetailAnalysis } from "./types";
import { finalizeDetailAnalysis, generateQA, reviewQAItemWorkflow, submitQAItem, updateQAItem, uploadAsset } from "#src/api/label-system";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { REVIEWED_OK_STATUSES } from "./constants";

interface UseAnnotationMutationsArgs {
	selectedAssetId: string | null
	selectedQaId: string | null
	assets: DataAsset[]
}

export function useAnnotationMutations({ selectedAssetId, selectedQaId, assets }: UseAnnotationMutationsArgs) {
	const queryClient = useQueryClient();
	const submitRequiredStatuses = new Set(["orange_pending_review", "red_required_review", "reviewed_reject"]);

	// 生成 QA — 根据选中资产类型动态传 modality
	const genMutation = useMutation({
		mutationFn: (assetId: string) => {
			const asset = assets.find(a => a.id === assetId);
			const modality = asset?.data_type ?? "text";
			return generateQA({ asset_id: assetId, modality, candidate_models: ["glm-text", "qwen-text"], item_count: 3 });
		},
		onSuccess: (data: QARunResponse) => {
			window.$message?.success(`已生成 ${data.generated_count} 条智能评估 (绿${data.green_count}/橙${data.orange_count}/红${data.red_count})`);
			queryClient.invalidateQueries({ queryKey: ["ls-qa-asset", selectedAssetId] });
		},
		onError: (e: any) => window.$message?.error(e?.message || "生成标注失败"),
	});
	const saveMutation = useMutation({
		mutationFn: ({ id, payload }: { id: string, payload: Partial<QAItem> }) => updateQAItem(id, payload),
		onSuccess: () => {
			window.$message?.success("标注项已保存");
			queryClient.invalidateQueries({ queryKey: ["ls-qa-asset", selectedAssetId] });
			queryClient.invalidateQueries({ queryKey: ["ls-qa-detail", selectedQaId] });
		},
		onError: (e: any) => window.$message?.error(e?.message || "保存失败"),
	});
	const submitMutation = useMutation({
		mutationFn: (id: string) => submitQAItem(id, true),
		onSuccess: () => {
			window.$message?.success("已提交标注项审核");
			queryClient.invalidateQueries({ queryKey: ["ls-qa-asset", selectedAssetId] });
			queryClient.invalidateQueries({ queryKey: ["ls-qa-detail", selectedQaId] });
		},
		onError: (e: any) => window.$message?.error(e?.message || "提交审核失败"),
	});
	const reviewMutation = useMutation({
		mutationFn: ({ id, approved }: { id: string, approved: boolean }) => reviewQAItemWorkflow(id, { approved }),
		onSuccess: (_d, vars) => {
			window.$message?.success(vars.approved ? "已通过审核" : "已驳回标注项");
			queryClient.invalidateQueries({ queryKey: ["ls-qa-asset", selectedAssetId] });
			queryClient.invalidateQueries({ queryKey: ["ls-qa-detail", selectedQaId] });
		},
		onError: (e: any) => window.$message?.error(e?.message || "审核失败"),
	});
	// finalize 裁决: 从多模型结果中选定最终答案
	const finalizeMutation = useMutation({
		mutationFn: async ({ id, status }: { id: string, status?: string }) => {
			if (status && REVIEWED_OK_STATUSES.has(status))
				return { skipped: true };
			if (status && submitRequiredStatuses.has(status))
				await submitQAItem(id, true, "定稿为最终答案");
			return reviewQAItemWorkflow(id, { approved: true, comment: "定稿为最终答案" });
		},
		onSuccess: () => {
			window.$message?.success("已定稿为最终答案");
			queryClient.invalidateQueries({ queryKey: ["ls-qa-asset", selectedAssetId] });
			queryClient.invalidateQueries({ queryKey: ["ls-qa-detail", selectedQaId] });
		},
		onError: (e: any) => window.$message?.error(e?.message || "定稿失败"),
	});
	const uploadMutation = useMutation({
		mutationFn: ({ file, name }: { file: File, name: string }) => uploadAsset(file, name),
		onSuccess: async (asset, vars) => {
			queryClient.invalidateQueries({ queryKey: ["ls-assets"] });
			// 文本资产: 自动启动双模型标注
			if (asset.data_type === "text" && asset.normalized_markdown) {
				window.$message?.loading({ content: `正在对「${vars.name}」启动 GLM+Qwen 双模型自动标注...`, key: "auto-annotate", duration: 0 });
				try {
					const res = await generateQA({ asset_id: asset.id, modality: asset.data_type, candidate_models: ["glm-text", "qwen-text"], item_count: 3 });
					window.$message?.success({ content: `自动标注完成: 生成 ${res.generated_count} 条 (绿${res.green_count}/橙${res.orange_count}/红${res.red_count})`, key: "auto-annotate", duration: 6 });
					queryClient.invalidateQueries({ queryKey: ["ls-assets"] });
				}
				catch (e: unknown) {
					const msg = e instanceof Error ? e.message : String(e);
					window.$message?.warning({ content: `自动标注未完成: ${msg || "请点「生成智能评估」手动生成"}`, key: "auto-annotate", duration: 8 });
				}
			}
			else {
				window.$message?.success("上传成功");
			}
		},
		onError: (e: any) => window.$message?.error(e?.message || "上传失败"),
	});

	// ★ 多模态分析结果落库为 QAItem (图片区域 / 视频关键帧 / 时间窗)
	// 融合自原 image-annotation / video-annotation 的 saveAnnotationMutation, 现统一在工作台内
	const finalizeAnalysisMutation = useMutation({
		mutationFn: (detail: DetailAnalysis) => {
			const payload = detailToFinalizePayload(detail);
			return finalizeDetailAnalysis(payload);
		},
		onSuccess: (data) => {
			window.$message?.success(`已保存为标注项 (${data.qa_item.score_bucket}桶)${data.qa_item.status === "pending_review" ? ", 已进入审核流" : ""}`);
			queryClient.invalidateQueries({ queryKey: ["ls-qa-asset", selectedAssetId] });
		},
		onError: (e: any) => window.$message?.error(e?.message || "保存标注项失败"),
	});

	return { genMutation, saveMutation, submitMutation, reviewMutation, finalizeMutation, uploadMutation, finalizeAnalysisMutation };
}

// 多模态分析结果 → 落库 payload (按 type 分派, 各分支只访问该类型持有的字段)
function detailToFinalizePayload(detail: DetailAnalysis): import("#src/api/label-system").DetailFinalizePayload {
	if (detail.type === "image") {
		return {
			detail_type: "image_region",
			asset_id: detail.asset_id,
			region_label: detail.region_label,
			question: detail.question,
			answer: detail.answer,
			evidence: detail.evidence ?? null,
			reasoning: detail.reasoning ?? null,
			score: detail.score,
			score_bucket: detail.bucket,
			candidate_models: detail.candidate_models,
			final_model: detail.final_model ?? null,
			votes: detail.votes,
			auto_submit: true,
		};
	}
	if (detail.type === "video") {
		return {
			detail_type: "video_frame",
			asset_id: detail.asset_id,
			timestamp: detail.timestamp,
			question: detail.question,
			answer: detail.answer,
			evidence: detail.evidence ?? null,
			reasoning: detail.reasoning ?? null,
			score: detail.score,
			score_bucket: detail.bucket,
			candidate_models: detail.candidate_models,
			final_model: detail.final_model ?? null,
			votes: detail.votes,
			auto_submit: true,
		};
	}
	return {
		detail_type: "video_window",
		asset_id: detail.asset_id,
		start_timestamp: detail.start_timestamp,
		end_timestamp: detail.end_timestamp,
		question: detail.question ?? "时间窗多帧分析",
		answer: detail.answer ?? "",
		score: detail.score,
		score_bucket: detail.bucket,
		candidate_models: detail.candidate_models,
		frames: (detail.frame_entries ?? []).map(f => ({ timestamp: f.timestamp ?? null, question: f.question, answer: f.answer, evidence: null, reasoning: null })),
		auto_submit: true,
	};
}
