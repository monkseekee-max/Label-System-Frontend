// ============================================================================
// WeKnora 知识库 API 适配层 (ADR-012)
// 通过 FastAPI BFF 代理 (/api/v1/kb/*) 访问 WeKnora, 前端不直连 WeKnora
// ============================================================================

import { isSuccessResponse } from "#src/api/shared";
import { useAuthStore } from "#src/store/auth";
import { request } from "#src/utils/request";

// ============================================================================
// Types
// ============================================================================

export interface KnowledgeBase {
	id: string
	name: string
	description?: string
	kb_type?: "document" | "faq" | "wiki"
	document_count?: number
	chunk_count?: number
	status?: string
	created_at?: string
	updated_at?: string
}

export interface KnowledgeChunk {
	id: string
	content: string
	knowledge_id: string
	chunk_index: number
	knowledge_title: string
	score: number
	chunk_type: string
	knowledge_filename?: string
}

export interface KBSession {
	id: string
	title?: string
	created_at?: string
}

export interface KBChatMessage {
	id: string
	response_type: "references" | "answer" | "thinking" | "tool_call" | "tool_result" | "error" | "session_title"
	content: string
	done: boolean
	knowledge_references?: Array<{
		id: string
		content: string
		knowledge_title: string
		score: number
		chunk_index: number
	}>
}

// ============================================================================
// API Functions
// ============================================================================

// ——— 知识库管理 ———

export function fetchKnowledgeBases() {
	// FastAPI 代理直接返回 WeKnora 裸数据 (无 code/message 信封)
	return request.get("v1/kb/knowledge-bases").json<any>().then((data) => {
		// 归一化为 {records, total}
		const records = Array.isArray(data) ? data : (data?.data ?? []);
		return {
			code: 200,
			message: "success",
			success: true,
			result: { records, total: records.length },
		};
	});
}

export function createKnowledgeBase(body: { name: string, description?: string, kb_type?: string }) {
	return request.post("v1/kb/knowledge-bases", { json: body }).json<any>();
}

export function fetchKnowledgeBaseDetail(id: string) {
	return request.get(`v1/kb/knowledge-bases/${id}`).json<any>();
}

// ——— 会话管理 ———

export function createKBSession(body: { title?: string } = {}) {
	return request.post("v1/kb/sessions", { json: body }).json<any>();
}

// ——— 检索 ———

export function searchKnowledge(body: {
	query: string
	knowledge_base_ids?: string[]
	knowledge_ids?: string[]
}) {
	return request.post("v1/kb/search", { json: body }).json<any>();
}

// ——— 同步到知识库 (markitdown文本→索引) ————

export interface KBSyncResult {
	success: boolean
	kb_id?: string
	doc_id?: string
	filename?: string
	chars?: number
	parse_status?: string
	error?: string
}

/**
 * 同步 markitdown 文本到 WeKnora 知识库 (自动嵌入+索引)
 * 后端: POST /api/v1/kb/sync { filename, markdown }
 */
export function syncKnowledge(filename: string, markdown: string) {
	return request.post("v1/kb/sync", { json: { filename, markdown } }).json<KBSyncResult>();
}

// ——— RAG 对话 (SSE 流式) ———

export interface KBChatParams {
	sessionId: string
	query: string
	knowledgeBaseIds?: string[]
	agentId?: string
}

// ——— RAG 对话 (Bridge版, 检索+vLLM生成) ————

export interface KBChatResult {
	answer: string
	sources: { content: string, score: number }[]
	has_context: boolean
}

/**
 * RAG 对话 (bridge版): 检索知识库 + vLLM 生成回答
 * 后端: POST /api/v1/kb/chat { query, kb_id? }
 */
export interface AgentOverride {
	model?: string
	temperature?: number
	maxTokens?: number
	systemPrompt?: string
}

export async function chatKnowledge(query: string, kbId?: string, agent?: AgentOverride): Promise<KBChatResult> {
	const resp = await request.post("v1/kb/chat", {
		json: {
			query,
			kb_id: kbId,
			...(agent?.model ? { model: agent.model } : {}),
			...(agent?.temperature != null ? { temperature: agent.temperature } : {}),
			...(agent?.maxTokens != null ? { max_tokens: agent.maxTokens } : {}),
			...(agent?.systemPrompt ? { system_prompt: agent.systemPrompt } : {}),
		},
	});
	const data = await resp.json<any>();
	if (data.success) {
		return data.data as KBChatResult;
	}
	throw new Error(data.error || "RAG 对话失败");
}

/**
 * 发起 RAG 对话, 返回 SSE 流解析器。
 * 用法:
 *   const stream = streamKBChat({ sessionId, query, knowledgeBaseIds });
 *   for await (const msg of stream) {
 *     if (msg.response_type === "answer") appendAnswer(msg.content);
 *   }
 */
export async function* streamKBChat(params: KBChatParams): AsyncGenerator<KBChatMessage> {
	const { sessionId, query, knowledgeBaseIds, agentId } = params;
	const resp = await fetch(`/api/v1/kb/chat/${sessionId}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${useAuthStore.getState().token}`,
		},
		body: JSON.stringify({
			query,
			knowledge_base_ids: knowledgeBaseIds,
			agent_id: agentId,
			channel: "web",
		}),
	});

	if (!isSuccessResponse(resp.status) || !resp.body) {
		throw new Error(`RAG 对话失败: HTTP ${resp.status}`);
	}

	const reader = resp.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done)
			break;
		buffer += decoder.decode(value, { stream: true });

		// SSE 以空行分隔事件
		const events = buffer.split("\n\n");
		buffer = events.pop() || "";

		for (const evt of events) {
			const lines = evt.split("\n");
			let dataLine = "";
			for (const line of lines) {
				if (line.startsWith("data: ")) {
					dataLine = line.slice(6);
				}
			}
			if (!dataLine)
				continue;
			try {
				const msg = JSON.parse(dataLine) as KBChatMessage;
				yield msg;
			}
			catch {
				// 跳过无法解析的行
			}
		}
	}
}
