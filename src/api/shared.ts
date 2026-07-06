export { ApiError } from "./types";
export type { ApiErrorCode, ApiErrorContext, ApiErrorOptions } from "./types";

export function isSuccessResponse(code: number): code is 200 {
	return code === 200;
}
