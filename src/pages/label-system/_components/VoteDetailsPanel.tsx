// ============================================================================
// 双模型解读展示面板 (复用组件)
// 完整展示多模型投票的 AI 解读: question/answer/evidence/reasoning/confidence
// + 相似度模式(语义/字符) + 一致度, 解决"只有打分没有具体内容"的交互缺陷
// ============================================================================

import type { VerificationResult } from "#src/api/label-system/intelligence";
import { verifySemantic } from "#src/api/label-system/intelligence";
import { BranchesOutlined, CheckCircleOutlined, CloseCircleOutlined, FontSizeOutlined, RobotOutlined, SafetyCertificateOutlined, WarningOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { Button, Card, Col, Empty, Progress, Row, Space, Tag, Typography } from "antd";
import { useState } from "react";

const { Text, Paragraph } = Typography;

export interface ModelVote {
	model_alias?: string | null
	question?: string | null
	answer?: string | null
	evidence?: string | null
	reasoning?: string | null
	confidence?: number | null
}

interface VoteDetailsPanelProps {
	/** 多模型投票详情 (每模型完整解读) */
	votes?: ModelVote[] | null
	/** 相似度对比模式: semantic=语义embedding / lexical=字符 */
	similarityMode?: string | null
	/** 模型一致度 (agreement_score, 0-1) */
	agreementScore?: number | null
	/** 候选模型列表 (用于标题汇总) */
	candidateModels?: string[] | null
}

/** 单字段行 (问题/答案/证据/推理), 空值不渲染 */
function VoteField({ label, value }: { label: string, value?: string | null }) {
	if (!value || !value.trim())
		return null;
	return (
		<div className="mb-2">
			<Text type="secondary" className="text-xs">
				{label}
				：
			</Text>
			<Paragraph style={{ marginBottom: 0, fontSize: 13, marginTop: 2 }}>{value}</Paragraph>
		</div>
	);
}

/**
 * 双模型 AI 解读对比面板。
 * 并排展示每个模型的完整解读内容 (问题/答案/证据/推理链/置信度),
 * 顶部标注相似度对比模式与模型一致度。
 */
export function VoteDetailsPanel({
	votes,
	similarityMode,
	agreementScore,
	candidateModels,
}: VoteDetailsPanelProps) {
	const list = (votes ?? []).filter(v => v && (v.answer || v.evidence || v.reasoning || v.question));
	const [verifyResult, setVerifyResult] = useState<VerificationResult | null>(null);
	const firstVote = list[0];

	const verifyMutation = useMutation({
		mutationFn: () =>
			verifySemantic({
				question: firstVote?.question ?? "",
				answer: firstVote?.answer ?? "",
				evidence: firstVote?.evidence ?? null,
				reasoning: firstVote?.reasoning ?? null,
			}),
		onSuccess: (r) => {
			setVerifyResult(r);
			if (r.overall_verdict === "pass")
				window.$message?.success("验证通过");
			else if (r.overall_verdict === "warn")
				window.$message?.warning("验证告警");
			else window.$message?.error("验证失败: 检测到问题");
		},
	});

	if (list.length === 0) {
		return (
			<Empty
				image={Empty.PRESENTED_IMAGE_SIMPLE}
				description={(
					<span className="text-xs">
						暂无模型解读详情
						{candidateModels && candidateModels.length > 0 ? `（候选模型: ${candidateModels.join(" + ")}）` : ""}
					</span>
				)}
				className="my-2"
			/>
		);
	}

	return (
		<div>
			<Space size={8} wrap style={{ marginBottom: 10 }}>
				<Text type="secondary" className="text-xs">
					<RobotOutlined />
					{" "}
					双模型 AI 解读对比
				</Text>
				{similarityMode && (
					<Tag color={similarityMode === "semantic" ? "geekblue" : "default"} className="text-xs">
						{similarityMode === "semantic"
							? (
								<>
									<BranchesOutlined />
									{" "}
									语义相似度
								</>
							)
							: (
								<>
									<FontSizeOutlined />
									{" "}
									字符相似度
								</>
							)}
					</Tag>
				)}
				{agreementScore != null && (
					<Text type="secondary" className="text-xs">
						模型一致度:
						{" "}
						<Text strong>
							{(agreementScore * 100).toFixed(1)}
							%
						</Text>
					</Text>
				)}
				{candidateModels && candidateModels.length > 0 && (
					<Text type="secondary" className="text-xs">
						{candidateModels.join(" + ")}
					</Text>
				)}
			</Space>
			<Row gutter={12}>
				{list.map((v, i) => {
					const colCount = Math.min(list.length, 2);
					return (
						<Col key={i} xs={24} sm={24 / colCount}>
							<Card
								size="small"
								title={(
									<Space size={6}>
										<Text strong className="text-[13px]">
											{v.model_alias || `模型 ${i + 1}`}
										</Text>
										{v.confidence != null && (
											<Tag color="blue" className="text-[11px]">
												置信度
												{" "}
												{v.confidence.toFixed(1)}
												%
											</Tag>
										)}
									</Space>
								)}
								style={{ height: "100%" }}
							>
								<VoteField label="问题" value={v.question} />
								<VoteField label="答案" value={v.answer} />
								<VoteField label="证据" value={v.evidence} />
								<VoteField label="推理链" value={v.reasoning} />
							</Card>
						</Col>
					);
				})}
			</Row>

			{/* 引擎③ 质量验证器: 共识≠正确, 独立校验 */}
			{firstVote && (
				<Card
					size="small"
					style={{ marginTop: 10 }}
					title={(
						<Space>
							<SafetyCertificateOutlined />
							<Text className="text-xs">质量验证 (共识≠正确)</Text>
						</Space>
					)}
				>
					<Space orientation="vertical" className="w-full">
						<Button size="small" type="primary" ghost loading={verifyMutation.isPending} onClick={() => verifyMutation.mutate()} icon={<SafetyCertificateOutlined />}>运行验证器</Button>
						{verifyResult && (
							<>
								<Space size={4}>
									<Tag color={verifyResult.overall_verdict === "pass" ? "success" : verifyResult.overall_verdict === "warn" ? "warning" : "error"}>
										{verifyResult.overall_verdict === "pass"
											? (
												<>
													<CheckCircleOutlined />
													{" "}
													通过
												</>
											)
											: verifyResult.overall_verdict === "warn"
												? (
													<>
														<WarningOutlined />
														{" "}
														告警
													</>
												)
												: (
													<>
														<CloseCircleOutlined />
														{" "}
														失败
													</>
												)}
									</Tag>
									{verifyResult.hallucination_flag && <Tag color="error">幻觉检测</Tag>}
									{(verifyResult as { used_semantic?: boolean }).used_semantic && <Tag color="geekblue">语义embedding</Tag>}
								</Space>
								<Row gutter={8}>
									<Col span={8}><Progress type="circle" percent={Math.round(verifyResult.evidence_alignment * 100)} size={56} format={() => "证据"} /></Col>
									<Col span={8}><Progress type="circle" percent={Math.round(verifyResult.factuality * 100)} size={56} format={() => "事实"} /></Col>
									<Col span={8}><Progress type="circle" percent={Math.round(verifyResult.self_consistency * 100)} size={56} format={() => "自洽"} /></Col>
								</Row>
								{verifyResult.checks_failed.length > 0 && (
									<Text type="secondary" className="text-[11px]">
										未通过:
										{verifyResult.checks_failed.join(", ")}
									</Text>
								)}
							</>
						)}
					</Space>
				</Card>
			)}
		</div>
	);
}

export default VoteDetailsPanel;
