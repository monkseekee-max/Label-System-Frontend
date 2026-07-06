import { ApiError, parseApiErrorCode } from "#src/api/types";
import { isObject } from "#src/utils/is";
import { message } from "#src/utils/static-antd";

interface BackendErrorEnvelope {
	code?: unknown
	message?: unknown
	errorMsg?: unknown
	error_code?: unknown
	context?: unknown
}

function parseErrorCode(value: unknown, fallback: number): number {
	return typeof value === "number" ? value : fallback;
}

function parseErrorMessage(json: BackendErrorEnvelope, fallback: string): string {
	if (typeof json.message === "string" && json.message) {
		return json.message;
	}
	if (typeof json.errorMsg === "string" && json.errorMsg) {
		return json.errorMsg;
	}
	return fallback;
}

function parseErrorContext(value: unknown) {
	return isObject(value) ? value as Record<string, unknown> : undefined;
}

export async function parseErrorResponse(response: Response): Promise<ApiError> {
	let errorMessage = response.statusText;
	let code = response.status;
	let errorCode;
	let context;

	try {
		const data = await response.json();

		if (isObject(data)) {
			const json = data as BackendErrorEnvelope;
			code = parseErrorCode(json.code, response.status);
			errorMessage = parseErrorMessage(json, response.statusText);
			errorCode = parseApiErrorCode(json.error_code);
			context = parseErrorContext(json.context);
		}
	}
	catch (e) {
		console.error("Error parsing JSON:", e);
	}

	return new ApiError({
		code,
		message: errorMessage,
		errorCode,
		context,
		status: response.status,
	});
}

export async function handleErrorResponse(response: Response): Promise<ApiError> {
	const error = await parseErrorResponse(response);
	const errorMessage = error.message;
	message.error(errorMessage);
	return error;
}
