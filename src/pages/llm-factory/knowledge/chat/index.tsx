import type { AgentOverride, KnowledgeBase } from "#src/api/llm-factory/knowledge";
import { chatKnowledge, fetchKnowledgeBases } from "#src/api/llm-factory/knowledge";
import { BasicContent } from "#src/components/basic-content";
import { QueryState } from "#src/components/query-state";
import { useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { renderMarkdownSafe } from "#src/utils/markdown";
import {
	BulbOutlined,
	ClearOutlined,
	MessageOutlined,
	PaperClipOutlined,
	RobotOutlined,
	SettingOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
	Button,
	Card,
	Col,
	Collapse,
	Empty,
	Input,
	InputNumber,
	Row,
	Select,
	Slider,
	Space,
	Switch,
	Tag,
	Typography,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";

const { Text } = Typography;

interface ChatMessage {
	role: "user" | "assistant"
	content: string
	references?: { content: string, score: number }[]
	reasoning?: string
}

// vLLM:8001 实际服务的模型 (KB chat 直连 vLLM, 非 new-api)
const MODELS = [
	{ value: "qwen3-8b", label: "Qwen3-8B (本地 vLLM)" },
	{ value: "latest", label: "Latest (最新 LoRA)" },
];

const DEFAULT_AGENT: AgentOverride = { model: "qwen3-8b", temperature: 0.3, maxTokens: 1024 };
const STORAGE_KEY = "smart-qa-agent-config";

// 智能体设置: 默认不覆盖人设 (用系统内置); 启用 overridePersona 后才下发 systemPrompt
interface AgentState extends AgentOverride {
	overridePersona: boolean
}

const DEFAULT_STATE: AgentState = { ...DEFAULT_AGENT, overridePersona: false };

function loadState(): AgentState {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw)
			return { ...DEFAULT_STATE, ...JSON.parse(raw) };
	}
	catch {
		// ignore
	}
	return DEFAULT_STATE;
}

export default function KnowledgeChat() {
	const token = useLlmTokens();
	const [agent, setAgent] = useState<AgentState>(loadState);
	const [selectedBaseIds, setSelectedBaseIds] = useState<string[]>([]);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(false);
	const sessionIdRef = useRef<string | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	// 持久化智能体设置
	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(agent));
		}
		catch {
			// ignore
		}
	}, [agent]);

	const basesQuery = useQuery({ queryKey: ["knowledge-bases", "list"], queryFn: fetchKnowledgeBases });
	const bases: KnowledgeBase[] = basesQuery.data?.result.records ?? [];

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
	}, [messages]);

	const baseOptions = useMemo(
		() => bases.map(b => ({ label: `${b.name}${b.document_count ? ` (${b.document_count})` : ""}`, value: b.id })),
		[bases],
	);

	function patchAgent(patch: Partial<AgentState>) {
		setAgent(prev => ({ ...prev, ...patch }));
	}

	async function handleSend() {
		const query = input.trim();
		if (!query || loading)
			return;

		// 仅在启用 overridePersona 时下发 systemPrompt
		const agentOverride: AgentOverride = {
			model: agent.model,
			temperature: agent.temperature,
			maxTokens: agent.maxTokens,
			...(agent.overridePersona && agent.systemPrompt ? { systemPrompt: agent.systemPrompt } : {}),
		};

		setInput("");
		setLoading(true);
		setMessages(prev => [...prev, { role: "user", content: query }, { role: "assistant", content: "", reasoning: "" }]);

		try {
			const result = await chatKnowledge(query, selectedBaseIds[0], agentOverride);
			setMessages((prev) => {
				const next = [...prev];
				const last = next[next.length - 1];
				if (last && last.role === "assistant") {
					next[next.length - 1] = {
						...last,
						content: result.answer,
						references: result.sources,
					};
				}
				return next;
			});
		}
		catch (e) {
			setMessages((prev) => {
				const next = [...prev];
				next[next.length - 1] = { role: "assistant", content: `对话失败: ${e}` };
				return next;
			});
		}
		finally {
			setLoading(false);
		}
	}

	function renderMarkdown(text: string) {
		if (!text)
			return "";
		try {
			return renderMarkdownSafe(text);
		}
		catch {
			return text;
		}
	}

	return (
		<BasicContent>
			<Row gutter={16}>
				{/* 左侧: 知识库 + 智能体设置 */}
				<Col xs={24} lg={6}>
					<Card
						size="small"
						className="mb-4"
						title={(
							<Space>
								<RobotOutlined />
								知识库范围
							</Space>
						)}
					>
						<Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
							选择问答范围 (留空则全库)
						</Text>
						<QueryState
							isLoading={basesQuery.isLoading}
							isError={basesQuery.isError}
							isEmpty={bases.length === 0}
							error={basesQuery.error}
							onRetry={() => basesQuery.refetch()}
							emptyText="暂无知识库, 请先在数据管理中上传文档后入库"
							skeletonRows={2}
						>
							<Select
								placeholder="选择知识库"
								className="w-full"
								value={selectedBaseIds}
								onChange={setSelectedBaseIds}
								options={baseOptions}
								allowClear
							/>
						</QueryState>
					</Card>

					{/* 智能体设置 (合并自原「智能体配置」页, 现在真正生效) */}
					<Card size="small">
						<Collapse
							defaultActiveKey={["agent"]}
							items={[{
								key: "agent",
								label: (
									<Space>
										<SettingOutlined />
										智能体设置
									</Space>
								),
								children: (
									<Space direction="vertical" size={14} className="w-full">
										<div>
											<Text type="secondary" className="text-xs">模型</Text>
											<Select
												className="w-full mt-1"
												value={agent.model}
												onChange={(v: string) => patchAgent({ model: v })}
												options={MODELS}
											/>
										</div>
										<div>
											<Text type="secondary" className="text-xs">
												Temperature:
												{" "}
												{agent.temperature?.toFixed(1)}
											</Text>
											<Slider
												min={0}
												max={2}
												step={0.1}
												value={agent.temperature ?? 0.3}
												onChange={v => patchAgent({ temperature: v })}
												className="mt-1"
											/>
										</div>
										<div>
											<Text type="secondary" className="text-xs">Max Tokens</Text>
											<InputNumber
												className="w-full mt-1"
												min={128}
												max={8192}
												step={128}
												value={agent.maxTokens ?? 1024}
												onChange={v => patchAgent({ maxTokens: v ?? 1024 })}
											/>
										</div>
										<div>
											<Space className="w-full justify-between">
												<Text type="secondary" className="text-xs">自定义人设</Text>
												<Switch
													size="small"
													checked={agent.overridePersona}
													onChange={v => patchAgent({ overridePersona: v })}
												/>
											</Space>
											<Input.TextArea
												className="mt-1"
												rows={3}
												disabled={!agent.overridePersona}
												value={agent.systemPrompt ?? ""}
												onChange={e => patchAgent({ systemPrompt: e.target.value })}
												placeholder="定义 Agent 的角色与风格，例如：你是一个专业的桥梁检测专家，回答要严谨、引用规范条文…"
											/>
											{!agent.overridePersona && (
												<Text type="secondary" className="text-[11px]">
													关闭时使用系统内置人设 (华明检测知识助手)
												</Text>
											)}
										</div>
									</Space>
								),
							}]}
						/>
					</Card>
				</Col>

				{/* 右侧: 对话区 */}
				<Col xs={24} lg={18}>
					<Card
						title={(
							<Space>
								<MessageOutlined />
								智能问答
							</Space>
						)}
						extra={(
							<Button
								icon={<ClearOutlined />}
								onClick={() => {
									setMessages([]);
									sessionIdRef.current = null;
								}}
							>
								清空
							</Button>
						)}
						styles={{ body: { padding: 0 } }}
					>
						{/* 消息列表 */}
						<div ref={scrollRef} style={{ height: "60vh", overflowY: "auto", padding: 16 }}>
							{messages.length === 0 && (
								<Empty description="开始提问, 基于知识库智能问答" style={{ marginTop: 120 }} />
							)}
							{messages.map((msg, i) => (
								<div
									key={i}
									style={{
										marginBottom: 16,
										display: "flex",
										justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
									}}
								>
									<div
										style={{
											maxWidth: "80%",
											padding: "10px 14px",
											borderRadius: 12,
											background: msg.role === "user" ? token.colorPrimary : token.colorFillQuaternary,
											color: msg.role === "user" ? token.colorTextLightSolid : token.colorText,
											wordBreak: "break-word",
										}}
									>
										{msg.role === "assistant" && msg.reasoning && (
											<details style={{ marginBottom: 8, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, padding: 6 }}>
												<summary style={{ cursor: "pointer", fontSize: 12, color: token.colorTextTertiary }}>
													<BulbOutlined />
													{" "}
													推理过程
												</summary>
												<div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 6, lineHeight: 1.7 }}>
													{msg.reasoning}
												</div>
											</details>
										)}
										{msg.role === "assistant"
											? (
												<div
													className="chat-answer"
													style={{ lineHeight: 1.7 }}
													dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) || (loading && i === messages.length - 1 ? "思考中…" : "") }}
												/>
											)
											: msg.content}
										{/* 引用来源 */}
										{msg.references && msg.references.length > 0 && (
											<div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
												<Text type="secondary" className="text-[11px]">
													<PaperClipOutlined />
													{" "}
													引用来源 (
													{msg.references.length}
													):
												</Text>
												{msg.references.slice(0, 3).map((ref, j) => (
													<Tag key={j} style={{ marginTop: 4, fontSize: 11, maxWidth: "100%", whiteSpace: "normal" }}>
														{ref.content.slice(0, 50)}
														... (score:
														{ref.score.toFixed(2)}
														)
													</Tag>
												))}
											</div>
										)}
									</div>
								</div>
							))}
						</div>
						{/* 输入区 */}
						<div style={{ borderTop: `1px solid ${token.colorBorder}`, padding: 12 }}>
							<Space.Compact className="w-full">
								<Input
									placeholder="基于知识库提问…"
									value={input}
									onChange={e => setInput(e.target.value)}
									onPressEnter={handleSend}
									disabled={loading}
								/>
								<Button type="primary" onClick={handleSend} loading={loading}>
									发送
								</Button>
							</Space.Compact>
						</div>
					</Card>
				</Col>
			</Row>
		</BasicContent>
	);
}
