import { isSuccessResponse } from "#src/api/shared";
import { request } from "#src/utils/request";

export type ConfigType = "MODEL" | "PROMPT" | "SYSTEM";
export type ConfigStatus = "ENABLED" | "DISABLED";

export interface SysConfigResponse {
	id: number
	configType: ConfigType
	configName: string
	configValue: string
	status: ConfigStatus
	creatorId: number
	createdAt: string
	updatedAt: string
}

export interface SaveSysConfigRequest {
	configType: ConfigType
	configName: string
	configValue: string
	status: ConfigStatus
}

export interface SysConfigListParams {
	configType?: ConfigType
	configName?: string
	status?: ConfigStatus
	pageNo?: number
	pageSize?: number
}

export interface PageResult<T> {
	records: T[]
	total: number
	pageNo: number
	pageSize: number
}

interface RawResponse<T> {
	code: number
	message: string
	data: T
}

function toApiResponse<T>(raw: RawResponse<T>): ApiResponse<T> {
	return {
		code: raw.code,
		message: raw.message,
		success: isSuccessResponse(raw.code),
		result: raw.data,
	};
}

function toApiResponseCompatible<T>(raw: RawResponse<T> | T): ApiResponse<T> {
	if (
		typeof raw === "object"
		&& raw !== null
		&& "code" in raw
		&& "data" in raw
	) {
		return toApiResponse(raw as RawResponse<T>);
	}

	return {
		code: 200,
		message: "success",
		success: true,
		result: raw as T,
	};
}

export function fetchSysConfigs(params?: SysConfigListParams) {
	return request.get("sys-configs", { searchParams: params as Record<string, string | number | undefined> }).json<RawResponse<PageResult<SysConfigResponse>> | PageResult<SysConfigResponse>>().then(toApiResponseCompatible);
}

export function createSysConfig(data: SaveSysConfigRequest) {
	return request.post("sys-configs", { json: data }).json<RawResponse<SysConfigResponse> | SysConfigResponse>().then(toApiResponseCompatible);
}

export function fetchSysConfigDetail(id: number) {
	return request.get(`sys-configs/${id}`).json<RawResponse<SysConfigResponse> | SysConfigResponse>().then(toApiResponseCompatible);
}

export function updateSysConfig(id: number, data: SaveSysConfigRequest) {
	return request.put(`sys-configs/${id}`, { json: data }).json<RawResponse<SysConfigResponse> | SysConfigResponse>().then(toApiResponseCompatible);
}
