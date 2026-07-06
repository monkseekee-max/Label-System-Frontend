export const API_ERROR_CODES = [
	"UNAUTHORIZED",
	"TASK_NOT_FOUND",
	"TASK_CANCEL_FAILED",
	"INFERENCE_ERROR",
	"INVALID_SCHEDULER_MODE",
	"PROPOSAL_NOT_FOUND",
	"RUN_NOT_FOUND",
	"LORA_VERSION_NOT_FOUND",
	"EVAL_JOB_NOT_FOUND",
	"EVAL_RESULT_NOT_FOUND",
	"BENCHMARK_NOT_FOUND",
	"MEDIA_NOT_FOUND",
	"MISSING_REQUEST_BODY",
	"INVALID_SOURCE",
	"RECORD_NOT_FOUND",
	"INVALID_STATUS",
	"INTERNAL",
] as const;

export type ApiErrorCode = typeof API_ERROR_CODES[number];
export type ApiErrorContext = Record<string, unknown>;

export interface ApiErrorOptions {
	code: number
	message: string
	errorCode?: ApiErrorCode
	context?: ApiErrorContext
	status?: number
}

export function parseApiErrorCode(value: unknown): ApiErrorCode | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	return API_ERROR_CODES.find(code => code === value);
}

export class ApiError extends Error {
	readonly code: number;
	readonly errorCode?: ApiErrorCode;
	readonly context?: ApiErrorContext;
	readonly status: number;

	constructor(message: string, status: number);
	constructor(options: ApiErrorOptions);
	constructor(messageOrOptions: string | ApiErrorOptions, status?: number) {
		const options = typeof messageOrOptions === "string"
			? { code: status ?? 0, message: messageOrOptions, status: status ?? 0 }
			: messageOrOptions;
		super(options.message);
		this.name = "ApiError";
		this.code = options.code;
		this.errorCode = options.errorCode;
		this.context = options.context;
		this.status = options.status ?? options.code;
	}
}
