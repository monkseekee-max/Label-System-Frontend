import { fetchTaskTypeList } from "#src/api/llm-factory";
import { BasicContent } from "#src/components/basic-content";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { CHART_COLORS, useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { useQuery } from "@tanstack/react-query";
import { Card, Col, Row, Tag } from "antd";
import * as React from "react";

const MODALITY_CONFIG: Record<string, { bg: string, color: string, icon: React.ReactNode }> = {
	text: {
		bg: "rgba(22,93,255,0.1)",
		color: CHART_COLORS.primary,
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
				<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
				<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
			</svg>
		),
	},
	image: {
		bg: "rgba(15,198,194,0.1)",
		color: CHART_COLORS.cyan,
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
				<rect x="3" y="3" width="18" height="18" rx="2" />
				<circle cx="8.5" cy="8.5" r="1.5" />
				<polyline points="21 15 16 10 5 21" />
			</svg>
		),
	},
	video: {
		bg: "rgba(89,126,247,0.1)",
		color: CHART_COLORS.indigo,
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
				<polygon points="23 7 16 12 23 17 23 7" />
				<rect x="1" y="5" width="15" height="14" rx="2" />
			</svg>
		),
	},
};

// eslint-disable-next-line unused-imports/no-unused-vars
const LABEL_TEMPLATES = {
	TextQA: `&lt;View&gt;
  &lt;Text name="context" value="$document_content"/&gt;
  &lt;Header value="问题"/&gt;
  &lt;Text name="question" value="$question"/&gt;
  &lt;Header value="回答"/&gt;
  &lt;TextArea name="answer"
    toName="question"
    placeholder="输入答案…"
    maxUsages="1"/&gt;
  &lt;Rating name="quality"
    toName="question"
    size="medium"/&gt;
&lt;/View&gt;`,

	ImageCaption: `&lt;View&gt;
  &lt;Image name="image" value="$image_url"
    zoom="true" zoomBy="1.5"/&gt;
  &lt;Header value="图像描述"/&gt;
  &lt;TextArea name="caption"
    toName="image"
    placeholder="描述图像内容…"
    maxUsages="1"/&gt;
  &lt;Rating name="quality"
    toName="image"/&gt;
&lt;/View&gt;`,

	VideoQA: `&lt;View&gt;
  &lt;Video name="video" value="$video_url"
    framerate="25"/&gt;
  &lt;Header value="视频问题"/&gt;
  &lt;TextArea name="question"
    toName="video"
    placeholder="输入问题…"/&gt;
  &lt;Header value="回答"/&gt;
  &lt;TextArea name="answer"
    toName="video"
    placeholder="输入答案…"
    maxUsages="1"/&gt;
  &lt;TimelineLabels name="timestamps"
    toName="video"&gt;
    &lt;Label value="关键片段"/&gt;
  &lt;/TimelineLabels&gt;
&lt;/View&gt;`,

	ImageQA: `&lt;View&gt;
  &lt;Image name="image" value="$image_url"
    zoom="true"/&gt;
  &lt;Header value="问题"/&gt;
  &lt;Text name="question" value="$question"/&gt;
  &lt;Header value="回答"/&gt;
  &lt;TextArea name="answer"
    toName="image"
    placeholder="输入答案…"
    maxUsages="1"/&gt;
  &lt;Choices name="category"
    toName="image"
    choice="single-radio"&gt;
    &lt;Choice value="描述类"/&gt;
    &lt;Choice value="推理类"/&gt;
    &lt;Choice value="计数类"/&gt;
  &lt;/Choices&gt;
&lt;/View&gt;`,
};

export default function LLMFactoryTaskTypes() {
	const token = useLlmTokens();
	const { data: taskTypes, error, isError, refetch } = useQuery({
		queryKey: ["llm-factory", "task-types"],
		queryFn: () => fetchTaskTypeList().then(r => r.result),
	});

	return (
		<BasicContent>
			<div className="mb-4">
				<h2 className="m-0 text-xl font-semibold">任务类型</h2>
				<p className="mt-1 text-sm" style={{ color: token.colorTextSecondary }}>
					6 种任务类型及其对应的推荐模型、训练轨道和 Label Studio 标注模板。ADR-009 DEC-02: task_type 抽象层贯穿全系统。
				</p>
			</div>

			{isError && <QueryErrorAlert error={error} onRetry={() => void refetch()} title="任务类型真实接口不可用" />}

			{/* Task Type Cards */}
			<Row gutter={16} className="mb-6">
				{taskTypes?.map((taskType) => {
					const config = MODALITY_CONFIG[taskType.modality];
					return (
						<Col span={8} key={taskType.id}>
							<Card
								className="rounded-[12px] [transition:box-shadow_0.15s]"
								style={{
									border: `1px solid ${token.colorBorder}`,
								}}
							>
								<div className="mb-4 flex items-center gap-3">
									<div
										style={{
											width: 44,
											height: 44,
											borderRadius: 8,
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											fontSize: 18,
											background: config.bg,
											color: config.color,
										}}
									>
										{config.icon}
									</div>
									<div className="flex-1">
										<div className="text-sm font-semibold">{taskType.name}</div>
										<div className="text-[11px]" style={{ color: token.colorTextTertiary }}>{taskType.subtitle}</div>
									</div>
									<Tag
										color={config.color}
										className="ml-auto rounded-full py-[2px] px-[10px] text-[10px] font-medium"
									>
										{taskType.modality}
									</Tag>
								</div>

								<div className="flex justify-between border-b border-[#f5f5f5] py-2 text-xs">
									<span style={{ color: token.colorTextTertiary }}>推荐模型</span>
									<span className="font-mono text-[11px]">{taskType.recommendedModel}</span>
								</div>
								<div className="flex justify-between border-b border-[#f5f5f5] py-2 text-xs">
									<span style={{ color: token.colorTextTertiary }}>训练轨道</span>
									<span className="font-mono text-[11px]">{taskType.trainingTrack}</span>
								</div>
								<div className="flex justify-between border-b border-[#f5f5f5] py-2 text-xs">
									<span style={{ color: token.colorTextTertiary }}>标注模板</span>
									<span className="font-mono text-[11px]">{taskType.labelTemplate}</span>
								</div>
								<div className="flex justify-between border-b border-[#f5f5f5] py-2 text-xs">
									<span style={{ color: token.colorTextTertiary }}>推理端口</span>
									<span className="font-mono text-[11px]">
										:
										{taskType.inferencePort}
									</span>
								</div>
								<div className="flex justify-between py-2 text-xs">
									<span style={{ color: token.colorTextTertiary }}>数据格式</span>
									<span className="font-mono text-[11px]">{taskType.dataFormat}</span>
								</div>
							</Card>
						</Col>
					);
				})}
			</Row>

			{/* Strategy Routing Mapping Table */}
			<Card className="mb-6">
				<div className="mb-4 flex items-center">
					<span className="mr-3 text-base font-semibold">策略路由映射</span>
					<span className="text-[11px]" style={{ color: token.colorTextTertiary }}>ADR-009 DEC-02: 所有组件按 task_type 路由</span>
				</div>
				<table className="w-full [border-collapse:collapse]">
					<thead>
						<tr style={{ borderBottom: `2px solid ${token.colorBorder}` }}>
							<th className="py-2 px-3 text-left text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: token.colorTextTertiary }}>
								任务大类
							</th>
							<th className="py-2 px-3 text-left text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: token.colorTextTertiary }}>
								task_type
							</th>
							<th className="py-2 px-3 text-left text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: token.colorTextTertiary }}>
								推荐模型
							</th>
							<th className="py-2 px-3 text-left text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: token.colorTextTertiary }}>
								训练轨道
							</th>
							<th className="py-2 px-3 text-left text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: token.colorTextTertiary }}>
								推理端口
							</th>
							<th className="py-2 px-3 text-left text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: token.colorTextTertiary }}>
								Converter
							</th>
							<th className="py-2 px-3 text-left text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: token.colorTextTertiary }}>
								Evaluator
							</th>
						</tr>
					</thead>
					<tbody>
						<tr className="border-b border-[#f5f5f5]">
							<td className="p-3">
								<Tag color="blue">text</Tag>
							</td>
							<td className="p-3 font-mono text-xs">text_qa, text_only</td>
							<td className="p-3 font-mono text-xs">qwen3-8b</td>
							<td className="p-3 font-mono text-xs">unsloth_sft</td>
							<td className="p-3 font-mono text-xs">:8001</td>
							<td className="p-3 text-[13px]">TextQAConverter</td>
							<td className="p-3 text-[13px]">TextMetrics (Jaccard/F1/ROUGE)</td>
						</tr>
						<tr className="border-b border-[#f5f5f5]">
							<td className="p-3">
								<Tag color="cyan">image</Tag>
							</td>
							<td className="p-3 font-mono text-xs">image_caption, image_qa</td>
							<td className="p-3 font-mono text-xs">qwen3.5-4b</td>
							<td className="p-3 font-mono text-xs">hf_peft_lora</td>
							<td className="p-3 font-mono text-xs">:8002</td>
							<td className="p-3 text-[13px]">MultimodalConverter</td>
							<td className="p-3 text-[13px]">ImageMetrics (BLEU/CIDEr/CLIPScore)</td>
						</tr>
						<tr>
							<td className="p-3">
								<Tag color="purple">video</Tag>
							</td>
							<td className="p-3 font-mono text-xs">video_qa, video_caption</td>
							<td className="p-3 font-mono text-xs">qwen3.5-4b</td>
							<td className="p-3 font-mono text-xs">hf_peft_lora</td>
							<td className="p-3 font-mono text-xs">:8002</td>
							<td className="p-3 text-[13px]">MultimodalConverter</td>
							<td className="p-3 text-[13px]">VideoMetrics (Accuracy/CIDEr)</td>
						</tr>
					</tbody>
				</table>
			</Card>

			{/* Label Studio Templates */}
			{/* <div>
				<h3 className="mb-4 text-base font-semibold">Label Studio 标注模板</h3>
				<Row gutter={16}>
					<Col span={12}>
						<Card
							className="mb-4 rounded-[12px]"
							style={{
								border: `1px solid ${token.colorBorder}`,
							}}
						>
							<div className="flex items-center justify-between py-4 px-5" style={{ borderBottom: `1px solid ${token.colorBorder}` }}>
								<div>
									<span className="font-medium">TextQA</span>
									<Tag color="blue" className="ml-2 rounded-full py-[2px] px-[10px] text-[10px] font-medium">
										text
									</Tag>
								</div>
								<button
									type="button"
									className="cursor-pointer rounded-[6px] py-1 px-3 text-xs"
									style={{
										border: `1px solid ${token.colorBorder}`,
										background: token.colorBgContainer,
									}}
								>
									复制 XML
								</button>
							</div>
							<div className="max-h-[280px] overflow-auto p-4">
								<pre
									className="m-0 whitespace-pre-wrap rounded-lg p-4 font-mono text-[11px] leading-[1.7]"
									style={{
										color: token.colorTextSecondary,
										background: token.colorFillQuaternary,
									}}
								>
									{LABEL_TEMPLATES.TextQA}
								</pre>
							</div>
						</Card>
					</Col>
					<Col span={12}>
						<Card
							className="mb-4 rounded-[12px]"
							style={{
								border: `1px solid ${token.colorBorder}`,
							}}
						>
							<div className="flex items-center justify-between py-4 px-5" style={{ borderBottom: `1px solid ${token.colorBorder}` }}>
								<div>
									<span className="font-medium">ImageCaption</span>
									<Tag color="cyan" className="ml-2 rounded-full py-[2px] px-[10px] text-[10px] font-medium">
										image
									</Tag>
								</div>
								<button
									type="button"
									className="cursor-pointer rounded-[6px] py-1 px-3 text-xs"
									style={{
										border: `1px solid ${token.colorBorder}`,
										background: token.colorBgContainer,
									}}
								>
									复制 XML
								</button>
							</div>
							<div className="max-h-[280px] overflow-auto p-4">
								<pre
									className="m-0 whitespace-pre-wrap rounded-lg p-4 font-mono text-[11px] leading-[1.7]"
									style={{
										color: token.colorTextSecondary,
										background: token.colorFillQuaternary,
									}}
								>
									{LABEL_TEMPLATES.ImageCaption}
								</pre>
							</div>
						</Card>
					</Col>
					<Col span={12}>
						<Card
							className="mb-4 rounded-[12px]"
							style={{
								border: `1px solid ${token.colorBorder}`,
							}}
						>
							<div className="flex items-center justify-between py-4 px-5" style={{ borderBottom: `1px solid ${token.colorBorder}` }}>
								<div>
									<span className="font-medium">VideoQA</span>
									<Tag color="purple" className="ml-2 rounded-full py-[2px] px-[10px] text-[10px] font-medium">
										video
									</Tag>
								</div>
								<button
									type="button"
									className="cursor-pointer rounded-[6px] py-1 px-3 text-xs"
									style={{
										border: `1px solid ${token.colorBorder}`,
										background: token.colorBgContainer,
									}}
								>
									复制 XML
								</button>
							</div>
							<div className="max-h-[280px] overflow-auto p-4">
								<pre
									className="m-0 whitespace-pre-wrap rounded-lg p-4 font-mono text-[11px] leading-[1.7]"
									style={{
										color: token.colorTextSecondary,
										background: token.colorFillQuaternary,
									}}
								>
									{LABEL_TEMPLATES.VideoQA}
								</pre>
							</div>
						</Card>
					</Col>
					<Col span={12}>
						<Card
							className="mb-4 rounded-[12px]"
							style={{
								border: `1px solid ${token.colorBorder}`,
							}}
						>
							<div className="flex items-center justify-between py-4 px-5" style={{ borderBottom: `1px solid ${token.colorBorder}` }}>
								<div>
									<span className="font-medium">ImageQA</span>
									<Tag color="cyan" className="ml-2 rounded-full py-[2px] px-[10px] text-[10px] font-medium">
										image
									</Tag>
								</div>
								<button
									type="button"
									className="cursor-pointer rounded-[6px] py-1 px-3 text-xs"
									style={{
										border: `1px solid ${token.colorBorder}`,
										background: token.colorBgContainer,
									}}
								>
									复制 XML
								</button>
							</div>
							<div className="max-h-[280px] overflow-auto p-4">
								<pre
									className="m-0 whitespace-pre-wrap rounded-lg p-4 font-mono text-[11px] leading-[1.7]"
									style={{
										color: token.colorTextSecondary,
										background: token.colorFillQuaternary,
									}}
								>
									{LABEL_TEMPLATES.ImageQA}
								</pre>
							</div>
						</Card>
					</Col>
				</Row>
			</div> */}
		</BasicContent>
	);
}
