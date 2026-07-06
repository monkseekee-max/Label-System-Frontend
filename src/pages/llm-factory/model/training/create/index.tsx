import { BasicContent } from "#src/components/basic-content";
import { useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { ProFormSelect, StepsForm } from "@ant-design/pro-components";
import { useMutation } from "@tanstack/react-query";
import { Button, Card, Col, Descriptions, Result, Row, Statistic } from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

const TRIGGER_MODE_OPTIONS = [
	{ label: "自动（按流水线）", value: "AUTO" },
	{ label: "半自动", value: "SEMI_AUTO" },
	{ label: "手动", value: "MANUAL" },
];

const BASE_MODEL_OPTIONS = [
	{ label: "Qwen2.5-7B-Instruct", value: "Qwen2.5-7B" },
	{ label: "Qwen2.5-14B-Instruct", value: "Qwen2.5-14B" },
	{ label: "Qwen2.5-32B-Instruct", value: "Qwen2.5-32B" },
	{ label: "Llama3.1-8B-Instruct", value: "Llama3.1-8B" },
	{ label: "Llama3.1-70B-Instruct", value: "Llama3.1-70B" },
];

const LORA_RANK_OPTIONS = [
	{ label: "Rank 8", value: 8 },
	{ label: "Rank 16", value: 16 },
	{ label: "Rank 32", value: 32 },
	{ label: "Rank 64", value: 64 },
];

const LORA_ALPHA_OPTIONS = [
	{ label: "Alpha 16", value: 16 },
	{ label: "Alpha 32", value: 32 },
	{ label: "Alpha 64", value: 64 },
	{ label: "Alpha 128", value: 128 },
];

const TRAINING_TYPE_OPTIONS = [
	{ label: "Unsloth SFT", value: "unsloth_sft" },
	{ label: "Full Fine-tuning", value: "full_ft" },
	{ label: "QLoRA", value: "qlora" },
];

const DATASET_OPTIONS = [
	{ label: "SFT_Instruction_v3 (1,234条)", value: "SFT_Instruction_v3" },
	{ label: "SFT_Chat_v2 (856条)", value: "SFT_Chat_v2" },
	{ label: "Domain_Expert_v1 (432条)", value: "Domain_Expert_v1" },
];

function useCreateTraining() {
	return useMutation({
		mutationFn: async (_values: Record<string, any>) => {
			await new Promise(resolve => setTimeout(resolve, 1000));
			return { success: true, runId: `RUN-${Date.now().toString(36).toUpperCase()}` };
		},
		onSuccess: (_data) => {
			window.$message?.success("训练任务创建成功");
		},
	});
}

export default function CreateTraining() {
	const token = useLlmTokens();
	const navigate = useNavigate();
	const createMutation = useCreateTraining();
	const [formValues, setFormValues] = useState<Record<string, any>>({});

	const loraConfig = useMemo(() => {
		if (!formValues.loraRank || !formValues.loraAlpha)
			return "-";
		return `Rank ${formValues.loraRank}, Alpha ${formValues.loraAlpha}`;
	}, [formValues.loraRank, formValues.loraAlpha]);

	const trainParams = useMemo(() => {
		const parts: string[] = [];
		if (formValues.batchSize)
			parts.push(`BS=${formValues.batchSize}`);
		if (formValues.gradAccumulation)
			parts.push(`GA=${formValues.gradAccumulation}`);
		if (formValues.epochs)
			parts.push(`E=${formValues.epochs}`);
		if (formValues.maxSeqLength)
			parts.push(`Seq=${formValues.maxSeqLength}`);
		return parts.join(", ") || "-";
	}, [formValues.batchSize, formValues.gradAccumulation, formValues.epochs, formValues.maxSeqLength]);

	return (
		<BasicContent>
			<div className="mb-4">
				<h2 className="m-0 text-xl font-semibold">新建训练任务</h2>
				<p style={{ margin: "4px 0 0 0", color: token.colorTextSecondary, fontSize: 14 }}>
					5 步向导式配置，自动触发 7 步训练流水线
				</p>
			</div>

			<Card>
				<StepsForm<any>
					onFinish={async (values) => {
						const result = await createMutation.mutateAsync(values);
						if (result.success) {
							navigate("/llm-factory/model/training");
						}
						return true;
					}}
					stepsProps={{
						size: "small",
					}}
				>
					<StepsForm.StepForm name="trigger" title="触发模式">
						<div style={{ marginBottom: 16, color: token.colorTextSecondary }}>选择训练触发方式</div>
						<ProFormSelect
							name="triggerMode"
							label="触发模式"
							placeholder="选择触发模式"
							options={TRIGGER_MODE_OPTIONS}
							rules={[{ required: true, message: "请选择触发模式" }]}
							fieldProps={{
								onChange: val => setFormValues({ ...formValues, triggerMode: val }),
							}}
						/>
						<div style={{ marginTop: 16, padding: 16, background: token.colorPrimaryBg, borderRadius: 8 }}>
							<strong>模式说明：</strong>
							<ul style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
								<li>
									<strong>自动：</strong>
									数据就绪后自动触发，无需手动干预（推荐）
								</li>
								<li>
									<strong>半自动：</strong>
									门禁通过后需手动确认启动
								</li>
								<li>
									<strong>手动：</strong>
									完全手动控制启动时机
								</li>
							</ul>
						</div>
					</StepsForm.StepForm>

					<StepsForm.StepForm name="model" title="模型 & LoRA">
						<div style={{ marginBottom: 16, color: token.colorTextSecondary }}>选择基座模型和 LoRA 配置</div>
						<Row gutter={16}>
							<Col span={12}>
								<ProFormSelect
									name="baseModel"
									label="基座模型"
									placeholder="选择基座模型"
									options={BASE_MODEL_OPTIONS}
									rules={[{ required: true, message: "请选择基座模型" }]}
									fieldProps={{
										onChange: val => setFormValues({ ...formValues, baseModel: val }),
									}}
								/>
								<ProFormSelect
									name="trainingType"
									label="训练类型"
									placeholder="选择训练类型"
									options={TRAINING_TYPE_OPTIONS}
									rules={[{ required: true, message: "请选择训练类型" }]}
									fieldProps={{
										onChange: val => setFormValues({ ...formValues, trainingType: val }),
									}}
								/>
							</Col>
							<Col span={12}>
								<ProFormSelect
									name="loraRank"
									label="LoRA Rank"
									placeholder="选择 Rank"
									options={LORA_RANK_OPTIONS}
									rules={[{ required: true, message: "请选择 Rank" }]}
									fieldProps={{
										onChange: val => setFormValues({ ...formValues, loraRank: val }),
									}}
								/>
								<ProFormSelect
									name="loraAlpha"
									label="LoRA Alpha"
									placeholder="选择 Alpha"
									options={LORA_ALPHA_OPTIONS}
									rules={[{ required: true, message: "请选择 Alpha" }]}
									fieldProps={{
										onChange: val => setFormValues({ ...formValues, loraAlpha: val }),
									}}
								/>
							</Col>
						</Row>
					</StepsForm.StepForm>

					<StepsForm.StepForm name="params" title="训练参数">
						<div style={{ marginBottom: 16, color: token.colorTextSecondary }}>配置训练超参数</div>
						<Row gutter={16}>
							<Col span={12}>
								<ProFormSelect
									name="batchSize"
									label="Batch Size"
									placeholder="选择 Batch Size"
									options={[
										{ label: "1", value: 1 },
										{ label: "2", value: 2 },
										{ label: "4", value: 4 },
										{ label: "8", value: 8 },
									]}
									rules={[{ required: true, message: "请选择 Batch Size" }]}
									fieldProps={{
										onChange: val => setFormValues({ ...formValues, batchSize: val }),
									}}
								/>
								<ProFormSelect
									name="gradAccumulation"
									label="梯度累积"
									placeholder="选择梯度累积步数"
									options={[
										{ label: "1", value: 1 },
										{ label: "2", value: 2 },
										{ label: "4", value: 4 },
										{ label: "8", value: 8 },
									]}
									rules={[{ required: true, message: "请选择梯度累积" }]}
									fieldProps={{
										onChange: val => setFormValues({ ...formValues, gradAccumulation: val }),
									}}
								/>
							</Col>
							<Col span={12}>
								<ProFormSelect
									name="epochs"
									label="Epochs"
									placeholder="选择训练轮数"
									options={[
										{ label: "1", value: 1 },
										{ label: "3", value: 3 },
										{ label: "5", value: 5 },
										{ label: "10", value: 10 },
									]}
									rules={[{ required: true, message: "请选择 Epochs" }]}
									fieldProps={{
										onChange: val => setFormValues({ ...formValues, epochs: val }),
									}}
								/>
								<ProFormSelect
									name="maxSeqLength"
									label="Max Seq Length"
									placeholder="选择最大序列长度"
									options={[
										{ label: "2048", value: 2048 },
										{ label: "4096", value: 4096 },
										{ label: "8192", value: 8192 },
										{ label: "16384", value: 16384 },
									]}
									rules={[{ required: true, message: "请选择最大序列长度" }]}
									fieldProps={{
										onChange: val => setFormValues({ ...formValues, maxSeqLength: val }),
									}}
								/>
							</Col>
						</Row>
					</StepsForm.StepForm>

					<StepsForm.StepForm name="dataset" title="数据集">
						<div style={{ marginBottom: 16, color: token.colorTextSecondary }}>选择训练数据集</div>
						<ProFormSelect
							name="dataset"
							label="数据集"
							placeholder="选择训练数据集"
							options={DATASET_OPTIONS}
							rules={[{ required: true, message: "请选择数据集" }]}
							fieldProps={{
								onChange: val => setFormValues({ ...formValues, dataset: val }),
							}}
						/>
						<Card
							title="数据集预览"
							size="small"
							style={{ marginTop: 16, background: token.colorFillQuaternary }}
						>
							<Descriptions column={2} size="small">
								<Descriptions.Item label="样本数">1,234 条</Descriptions.Item>
								<Descriptions.Item label="平均长度">342 tokens</Descriptions.Item>
								<Descriptions.Item label="质量分">87.5</Descriptions.Item>
								<Descriptions.Item label="版本">v3.2</Descriptions.Item>
							</Descriptions>
						</Card>
					</StepsForm.StepForm>

					<StepsForm.StepForm name="confirm" title="确认启动">
						<Result
							status="info"
							title="确认训练配置"
							subTitle="请检查以下配置是否正确"
						/>
						<Row gutter={16} className="mb-4">
							<Col span={6}>
								<Statistic title="触发模式" value={formValues.triggerMode || "-"} styles={{ content: { fontSize: 16 } }} />
							</Col>
							<Col span={6}>
								<Statistic
									title="基座模型"
									value={BASE_MODEL_OPTIONS.find(o => o.value === formValues.baseModel)?.label || "-"}
									styles={{ content: { fontSize: 16 } }}
								/>
							</Col>
							<Col span={6}>
								<Statistic title="LoRA 配置" value={loraConfig} styles={{ content: { fontSize: 16 } }} />
							</Col>
							<Col span={6}>
								<Statistic title="训练参数" value={trainParams} styles={{ content: { fontSize: 16 } }} />
							</Col>
						</Row>
						<Card size="small" title="配置详情">
							<Descriptions column={2} size="small">
								<Descriptions.Item label="训练类型">
									{TRAINING_TYPE_OPTIONS.find(o => o.value === formValues.trainingType)?.label || "-"}
								</Descriptions.Item>
								<Descriptions.Item label="数据集">
									{DATASET_OPTIONS.find(o => o.value === formValues.dataset)?.label || "-"}
								</Descriptions.Item>
							</Descriptions>
						</Card>
					</StepsForm.StepForm>
				</StepsForm>

				<div style={{ marginTop: 16, textAlign: "right" }}>
					<Button onClick={() => navigate("/llm-factory/model/training")}>
						取消
					</Button>
				</div>
			</Card>
		</BasicContent>
	);
}
