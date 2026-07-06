import type { InferencePort } from "#src/api/llm-factory/types";
import { fetchInferencePorts } from "#src/api/llm-factory";
import { BasicContent } from "#src/components/basic-content";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { CHART_COLORS, TERMINAL_THEME, useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { useAuthStore } from "#src/store/auth";
import { BulbOutlined, CopyOutlined, ReloadOutlined, SendOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Col, Empty, Input, Row, Segmented, Space, Tag, Tooltip, Typography } from "antd";
import { useMemo, useState } from "react";

const { Text } = Typography;

// 模型选项对齐 vLLM 实际加载 (latest=LoRA 微调版, qwen3-8b=基座)
const MODEL_OPTIONS = [
	{ label: "latest (LoRA 微调)", value: "latest" },
	{ label: "qwen3-8b (基座)", value: "qwen3-8b" },
];

const MAX_HISTORY = 20;

/**
 * 拆分 Qwen3 思维链: 从流式拼接的原始 content (可能含未闭合的 <think> 标签) 中分离思考与回答.
 * 与后端 inference_chat 的逻辑对齐, 但面向部分输入 (流式进行中 think 标签可能未闭合).
 */
function splitReasoning(raw: string): { content: string, reasoning?: string } {
	const thinkCloseIdx = raw.indexOf("</think>");
	if (thinkCloseIdx >= 0) {
		const thinkOpenEnd = raw.indexOf(">") + 1;
		const reasoning = raw.slice(thinkOpenEnd, thinkCloseIdx).trim();
		const content = raw.slice(thinkCloseIdx + "</think>".length).trim();
		return { content, reasoning: reasoning || undefined };
	}
	// think 未闭合: 进行中, 全部算思考过程
	if (raw.trim().startsWith("<think")) {
		const afterTag = raw.slice(raw.indexOf(">") + 1).trim();
		return { content: "", reasoning: afterTag || undefined };
	}
	return { content: raw };
}

interface ChatResponse {
	content: string
	reasoning?: string
	has_reasoning?: boolean
	model?: string
	usage?: { prompt_tokens: number, completion_tokens: number, total_tokens: number }
}

interface ChatTurn {
	seq: number
	role: "user" | "assistant"
	content: string
	reasoning?: string
	model?: string
	usage?: ChatResponse["usage"]
	latency?: number
}

export default function InferenceService() {
	const token = useLlmTokens();
	const { data, error, isError, refetch } = useQuery({
		queryKey: ["llm-factory", "inference-ports"],
		queryFn: () => fetchInferencePorts().then(r => r.result),
		refetchInterval: 15000,
	});

	const [selectedModel, setSelectedModel] = useState("latest");
	const [inputValue, setInputValue] = useState("请简要说明什么是 LoRA 微调");
	const [history, setHistory] = useState<ChatTurn[]>([]);
	const [isTyping, setIsTyping] = useState(false);
	const [errorMsg, setErrorMsg] = useState("");
	const [lastLatency, setLastLatency] = useState<number | null>(null);
	const [lastUsage, setLastUsage] = useState<ChatResponse["usage"] | null>(null);

	// 推理端口是否可用 (至少一个 ONLINE)
	const hasOnlinePort = useMemo(() => data?.some(p => p.status === "ONLINE") ?? false, [data]);

	const handleSend = async () => {
		const prompt = inputValue.trim();
		if (isTyping || !prompt)
			return;

		setErrorMsg("");
		setIsTyping(true);
		const seq = Date.now();
		const userTurn: ChatTurn = { seq, role: "user", content: prompt };
		setHistory(h => [...h, userTurn].slice(-MAX_HISTORY));
		setInputValue("");
		const startTime = Date.now();

		try {
			// 流式 SSE 读取 (避免长推理被隧道/代理超时掐断, 且打字机效果)
			const { VITE_API_BASE_URL } = import.meta.env;
			const { token } = useAuthStore.getState();
			const resp = await fetch(`${VITE_API_BASE_URL}/v1/inference/chat`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({
					model: selectedModel,
					messages: [{ role: "user", content: prompt }],
					temperature: 0.7,
					max_tokens: 512,
					stream: true,
				}),
			});

			if (!resp.ok || !resp.body) {
				const errText = await resp.text().catch(() => "");
				throw new Error(errText || `HTTP ${resp.status}`);
			}

			// 先插入空 assistant 轮次, 后续逐 delta 填充 (打字机)
			const assistantSeq = seq + 1;
			setHistory(h => [...h, {
				seq: assistantSeq,
				role: "assistant",
				content: "",
				model: selectedModel,
				latency: Date.now() - startTime,
			} as ChatTurn].slice(-MAX_HISTORY));

			// 解析 SSE 流: 按 "\n\n" 分帧, 每帧 data: {...}
			const reader = resp.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			let rawContent = "";
			let usage: ChatResponse["usage"] | null = null;
			let hadError = false;
			while (true) {
				const { done, value } = await reader.read();
				if (done)
					break;
				buffer += decoder.decode(value, { stream: true });
				const frames = buffer.split("\n\n");
				buffer = frames.pop() ?? "";
				for (const frame of frames) {
					const line = frame.trim();
					if (!line.startsWith("data:"))
						continue;
					try {
						const ev = JSON.parse(line.slice(5).trim());
						if (ev.type === "delta" && ev.content) {
							rawContent += ev.content;
							const { content, reasoning } = splitReasoning(rawContent);
							setHistory(h => h.map(t => t.seq === assistantSeq ? { ...t, content: content || "(生成中…)", reasoning, latency: Date.now() - startTime } : t));
						}
						else if (ev.type === "done") {
							usage = ev.usage ?? null;
						}
						else if (ev.type === "error") {
							hadError = true;
							setErrorMsg(`推理失败: ${ev.error || "未知错误"}`);
						}
					}
					catch {
						// 忽略非 JSON 帧
					}
				}
			}

			// 流结束: 最终定格
			const { content: finalContent, reasoning: finalReasoning } = splitReasoning(rawContent);
			const latency = Date.now() - startTime;
			setHistory(h => h.map(t => t.seq === assistantSeq
				? { ...t, content: hadError ? "(生成失败)" : (finalContent || "(空响应)"), reasoning: finalReasoning, usage: usage ?? undefined, latency }
				: t));
			setLastLatency(latency);
			setLastUsage(usage);
		}
		catch (err: unknown) {
			const httpErr = err as { response?: { text?: () => Promise<string> }, message?: string };
			const msg = httpErr?.response ? await httpErr.response.text?.().catch(() => "") : String(err);
			setErrorMsg(`推理失败: ${msg || httpErr?.message || "未知错误"}`);
		}
		finally {
			setIsTyping(false);
		}
	};

	const handleClear = () => {
		setHistory([]);
		setErrorMsg("");
		setLastLatency(null);
		setLastUsage(null);
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard?.writeText(text).then(
			() => window.$message?.success("已复制"),
			() => window.$message?.error("复制失败"),
		);
	};

	return (
		<BasicContent>
			<div className="mb-4 flex items-center justify-between">
				<div>
					<h2 className="m-0 text-xl font-semibold">推理服务</h2>
					<p className="mb-0 mt-1 text-sm" style={{ color: token.colorTextSecondary }}>
						双端口 vLLM 推理引擎，文本与多模态分离部署，LoRA 热插拔
					</p>
				</div>
				<Space>
					<Button icon={<ReloadOutlined />} onClick={() => void refetch()}>刷新</Button>
				</Space>
			</div>

			{isError && <QueryErrorAlert error={error} onRetry={() => void refetch()} title="推理服务真实接口不可用" />}

			{/* Dual Port Cards */}
			<Row gutter={16} className="mb-6">
				{data?.map(port => (
					<Col xs={24} lg={12} key={port.port}>
						<PortCard port={port} />
					</Col>
				))}
				{data?.length === 0 && (
					<Col span={24}>
						<Card><Empty description="暂无推理端口数据" /></Card>
					</Col>
				)}
			</Row>

			{/* Playground */}
			<Card
				title={(
					<div className="flex items-center justify-between">
						<span className="text-base font-semibold">推理试玩</span>
						<Space size="middle">
							<Text className="text-xs" style={{ color: token.colorTextTertiary }}>
								{lastLatency !== null && `延迟 ${lastLatency}ms`}
								{lastUsage && ` · tokens ${lastUsage.prompt_tokens}+${lastUsage.completion_tokens}`}
							</Text>
							{history.length > 0 && <Button type="link" size="small" onClick={handleClear}>清空</Button>}
						</Space>
					</div>
				)}
			>
				<div className="mb-4">
					<Segmented options={MODEL_OPTIONS} value={selectedModel} onChange={v => setSelectedModel(v as string)} />
				</div>

				{/* Chat history / output */}
				<div
					className="mb-4 overflow-auto"
					style={{
						background: TERMINAL_THEME.bg,
						border: `1px solid ${TERMINAL_THEME.border}`,
						borderRadius: 8,
						padding: 16,
						minHeight: 280,
						maxHeight: 460,
						fontFamily: "monospace",
						fontSize: 13,
						lineHeight: 1.6,
					}}
				>
					{errorMsg && (
						<Alert
							className="mb-3 font-sans text-xs"
							type="error"
							showIcon
							message={errorMsg}
						/>
					)}
					{history.length === 0 && !isTyping
						? (
							<div style={{ color: TERMINAL_THEME.subtle, textAlign: "center", marginTop: 80 }}>
								输入 prompt 后按回车或点击发送，查看推理结果
							</div>
						)
						: (
							<Space direction="vertical" size={12} className="w-full">
								{history.map(turn => (
									<TurnBubble key={turn.seq} turn={turn} onCopy={copyToClipboard} />
								))}
								{isTyping && (
									<div style={{ color: TERMINAL_THEME.subtle }}>
										<span className="animate-pulse">▋ 推理中…</span>
									</div>
								)}
							</Space>
						)}
				</div>

				{/* Input */}
				<Input.TextArea
					value={inputValue}
					onChange={e => setInputValue(e.target.value)}
					onPressEnter={(e) => {
						if (!e.shiftKey) {
							e.preventDefault();
							void handleSend();
						}
					}}
					placeholder="输入测试 prompt… (Enter 发送, Shift+Enter 换行)"
					autoSize={{ minRows: 2, maxRows: 6 }}
					disabled={!hasOnlinePort && !isTyping}
				/>
				<div className="mt-3 flex items-center justify-between">
					<Text className="text-xs" style={{ color: token.colorTextTertiary }}>
						模型:
						{selectedModel}
						{!hasOnlinePort && " · 无在线端口"}
					</Text>
					<Space>
						<Button onClick={() => setInputValue("")} disabled={!inputValue}>清空输入</Button>
						<Button
							type="primary"
							icon={<SendOutlined />}
							onClick={() => void handleSend()}
							loading={isTyping}
							disabled={!inputValue.trim() || (!hasOnlinePort && !isTyping)}
						>
							发送
						</Button>
					</Space>
				</div>
			</Card>
		</BasicContent>
	);
}

// ============================================================
// 子组件: 单轮对话气泡
// ============================================================
function TurnBubble({ turn, onCopy }: { turn: ChatTurn, onCopy: (t: string) => void }) {
	const token = useLlmTokens();
	const isUser = turn.role === "user";
	return (
		<div className={isUser ? "text-right" : "text-left"}>
			{isUser
				? (
					<span
						className="inline-block max-w-[80%] rounded-lg px-3 py-2 text-left"
						style={{ background: token.colorPrimaryBg, color: token.colorText, border: `1px solid ${token.colorPrimaryBorder}` }}
					>
						{turn.content}
					</span>
				)
				: (
					<div className="max-w-[92%]">
						{turn.reasoning && (
							<details className="mb-2">
								<summary style={{ cursor: "pointer", color: TERMINAL_THEME.subtle, fontSize: 12, padding: "2px 0" }}>
									<BulbOutlined />
									{" "}
									思考过程 (点击展开)
								</summary>
								<div style={{ marginTop: 6, padding: 10, background: "rgba(255,255,255,0.04)", borderRadius: 4, color: TERMINAL_THEME.subtle, fontSize: 12, whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto" }}>
									{turn.reasoning}
								</div>
							</details>
						)}
						<div className="group relative" style={{ color: TERMINAL_THEME.text, whiteSpace: "pre-wrap" }}>
							{turn.content}
							<Tooltip title="复制">
								<Button
									className="absolute -right-2 -top-2 opacity-0 transition-opacity group-hover:opacity-100"
									type="text"
									size="small"
									icon={<CopyOutlined style={{ color: TERMINAL_THEME.subtle }} />}
									onClick={() => onCopy(turn.content)}
								/>
							</Tooltip>
						</div>
						{(turn.usage || turn.latency) && (
							<div style={{ color: TERMINAL_THEME.subtle, fontSize: 11, marginTop: 4 }}>
								{turn.model && <span className="mr-3">{turn.model}</span>}
								{turn.latency && (
									<span className="mr-3">
										{turn.latency}
										ms
									</span>
								)}
								{turn.usage && (
									<span>
										tokens
										{turn.usage.prompt_tokens}
										+
										{turn.usage.completion_tokens}
									</span>
								)}
							</div>
						)}
					</div>
				)}
		</div>
	);
}

// ============================================================
// 子组件: 推理端口卡片
// ============================================================
function PortCard({ port }: { port: InferencePort }) {
	const token = useLlmTokens();
	const isTextPort = port.type === "TEXT";
	const isOnline = port.status === "ONLINE";
	const gradient = isTextPort
		? `linear-gradient(90deg, ${CHART_COLORS.primary}, ${CHART_COLORS.blue})`
		: `linear-gradient(90deg, ${CHART_COLORS.cyan}, ${CHART_COLORS.success})`;

	// VRAM 分段从真实数据派生 (base/LoRA/KV/Free 按比例估算)
	const vramSegments = useMemo(() => {
		const used = isOnline ? port.vramUsed : 0;
		const total = port.vramTotal || 24;
		const free = Math.max(0, total - used);
		// 按端口类型分配已用部分的内部构成 (base 60%, LoRA 25%, KV 15%)
		const baseRatio = 0.6;
		const loraRatio = 0.25;
		const kvLabel = isTextPort ? "KV" : "Vision+KV";
		return [
			{ label: "Base", value: +(used * baseRatio).toFixed(1), color: CHART_COLORS.primary },
			{ label: "LoRA", value: +(used * loraRatio).toFixed(1), color: CHART_COLORS.cyan },
			{ label: kvLabel, value: +(used * (1 - baseRatio - loraRatio)).toFixed(1), color: CHART_COLORS.indigo },
			{ label: "Free", value: +free.toFixed(1), color: CHART_COLORS.success },
		];
	}, [port.vramUsed, port.vramTotal, isTextPort, isOnline]);

	return (
		<Card
			style={{
				borderRadius: 12,
				border: `1px solid ${token.colorBorder}`,
				position: "relative",
				overflow: "hidden",
			}}
			styles={{ body: { paddingTop: 16 } }}
		>
			{/* Top gradient bar */}
			<div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: gradient }} />

			{/* Header */}
			<div className="mb-4 flex items-center justify-between">
				<span className="text-base font-semibold">{isTextPort ? "文本推理端口" : "多模态推理端口"}</span>
				<Tag color={isOnline ? "success" : "default"}>
					{isOnline ? "运行中" : "离线"}
				</Tag>
			</div>

			{/* Stats */}
			<Row gutter={12} className="mb-4">
				<Col span={8}>
					<div className="rounded-lg p-3 text-center" style={{ background: token.colorFillQuaternary }}>
						<div className="font-mono text-xl font-bold">
							:
							{port.port}
						</div>
						<div className="mt-0.5 text-[11px]" style={{ color: token.colorTextTertiary }}>端口</div>
					</div>
				</Col>
				<Col span={8}>
					<div className="rounded-lg p-3 text-center" style={{ background: token.colorFillQuaternary }}>
						<div className="font-mono text-xl font-bold">{port.requestsPerSecond}</div>
						<div className="mt-0.5 text-[11px]" style={{ color: token.colorTextTertiary }}>req/s</div>
					</div>
				</Col>
				<Col span={8}>
					<div className="rounded-lg p-3 text-center" style={{ background: token.colorFillQuaternary }}>
						<div className="font-mono text-xl font-bold">
							{port.p50Latency}
							ms
						</div>
						<div className="mt-0.5 text-[11px]" style={{ color: token.colorTextTertiary }}>P50 延迟</div>
					</div>
				</Col>
			</Row>

			{/* VRAM Bar */}
			<div className="mb-4">
				<div className="mb-2 flex justify-between text-xs">
					<span>VRAM 占用</span>
					<span className="font-mono" style={{ color: token.colorTextTertiary }}>
						{port.vramUsed}
						{" "}
						/
						{port.vramTotal}
						{" "}
						GB
					</span>
				</div>
				<div className="flex h-6 overflow-hidden rounded">
					{vramSegments.map(segment => (
						<Tooltip key={segment.label} title={`${segment.label}: ${segment.value}GB`}>
							<div
								style={{
									flex: segment.value || 0.01,
									background: segment.color,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 10,
									fontWeight: 500,
									color: token.colorBgContainer,
									whiteSpace: "nowrap",
									padding: "0 6px",
								}}
							>
								{segment.value > 1 && segment.label}
							</div>
						</Tooltip>
					))}
				</div>
			</div>

			{/* LoRA Adapters */}
			<div>
				<div className="mb-2 text-[13px] font-semibold">LoRA 热插拔</div>
				{port.loraAdapters.length > 0
					? (
						<Space direction="vertical" className="w-full" size={8}>
							{port.loraAdapters.map(adapter => (
								<div
									key={adapter.id}
									className="flex items-center gap-3 rounded-lg p-3 text-xs"
									style={{ background: token.colorFillQuaternary }}
								>
									<span
										style={{
											width: 8,
											height: 8,
											borderRadius: "50%",
											background: adapter.isActive ? token.colorSuccess : token.colorTextQuaternary,
											boxShadow: adapter.isActive ? `0 0 6px ${token.colorSuccess}` : "none",
											flexShrink: 0,
										}}
									/>
									<span className="flex-1 font-medium">{adapter.name}</span>
									<span className="font-mono text-[11px]" style={{ color: token.colorTextTertiary }}>
										{adapter.isActive ? `${adapter.requestRate} req/h` : "空闲"}
									</span>
								</div>
							))}
						</Space>
					)
					: (
						<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无已加载 LoRA 适配器" />
					)}
			</div>
		</Card>
	);
}
