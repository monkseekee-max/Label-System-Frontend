import { isSuccessResponse } from "#src/api/shared";

// ============================================================================
// API Functions (with mock data)
// ============================================================================

export interface RawResponse<T> {
	code: number
	message: string
	data: T
}

export function toApiResponse<T>(raw: RawResponse<T>): ApiResponse<T> {
	return {
		code: raw.code,
		message: raw.message,
		success: isSuccessResponse(raw.code),
		result: raw.data,
	};
}

// Simulated delay
export async function delay(ms: number) {
	await new Promise(resolve => setTimeout(resolve, ms));
}

export function parseBooleanEnv(value: string | boolean | undefined): boolean | undefined {
	if (value === undefined || value === null || value === "") {
		return undefined;
	}
	if (typeof value === "boolean") {
		return value;
	}
	const normalized = String(value).trim().toLowerCase();
	if (["1", "true", "yes", "on"].includes(normalized)) {
		return true;
	}
	if (["0", "false", "no", "off"].includes(normalized)) {
		return false;
	}
	return undefined;
}

export function isMockFallbackEnabled(): boolean {
	if (import.meta.env.PROD || import.meta.env.MODE === "production") {
		return false;
	}
	const configured = parseBooleanEnv(import.meta.env.VITE_ENABLE_MOCK_FALLBACK);
	if (configured !== undefined) {
		return configured;
	}
	return true;
}

export class FactoryApiError extends Error {
	endpoint: string;
	mockFallbackEnabled: boolean;

	constructor(endpoint: string, message: string, cause?: unknown) {
		super(message);
		this.name = "FactoryApiError";
		this.endpoint = endpoint;
		this.mockFallbackEnabled = isMockFallbackEnabled();
		if (cause !== undefined) {
			(this as { cause?: unknown }).cause = cause;
		}
	}
}

export function resolveFactoryEndpoint(): string {
	const stack = new Error("resolveFactoryEndpoint").stack?.split("\n") ?? [];
	for (const frame of stack.slice(2)) {
		const match = frame.match(/at (?:async )?([^\s(]+)/);
		const endpoint = match?.[1]?.replace(/^Object\./, "");
		if (endpoint && endpoint !== "withFallback" && endpoint !== "resolveFactoryEndpoint") {
			return endpoint;
		}
	}
	return "llm-factory";
}

/** 包装真实后端调用, 失败时回退到 mockFn (保证前端鲁棒) */
export async function withFallback<T>(
	realFn: () => Promise<T>,
	mockFn: () => Promise<ApiResponse<T>>,
): Promise<ApiResponse<T>> {
	const endpoint = resolveFactoryEndpoint();
	const fallbackEnabled = isMockFallbackEnabled();
	try {
		const data = await realFn();
		return toApiResponse({ code: 200, message: "success", data });
	}
	catch (error) {
		if (!fallbackEnabled) {
			console.error(`[factory-api] ${endpoint} failed, mock fallback disabled`, error);
			throw new FactoryApiError(endpoint, `真实后端调用失败且 mock fallback 已禁用: ${endpoint}`, error);
		}
		console.warn(`[factory-api] ${endpoint} 后端调用失败, 回退 mock:`, error);
		try {
			return await mockFn();
		}
		catch (mockError) {
			throw new FactoryApiError(endpoint, `mock fallback failed: ${endpoint}`, mockError);
		}
	}
}
