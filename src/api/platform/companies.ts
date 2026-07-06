import { isSuccessResponse } from "#src/api/shared";
import { request } from "#src/utils/request";

export interface CompanyResponse {
	companyId: number
	companyCode: string
	companyName: string
	status: "ENABLED" | "DISABLED"
}

export interface CreateCompanyRequest {
	companyCode: string
	companyName: string
}

export interface UpdateCompanyStatusRequest {
	status: "ENABLED" | "DISABLED"
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

export function fetchCompanyList() {
	return request.get("platform/companies").json<RawResponse<CompanyResponse[]>>().then(toApiResponse);
}

export function createCompany(data: CreateCompanyRequest) {
	return request.post("platform/companies", { json: data }).json<RawResponse<CompanyResponse>>().then(toApiResponse);
}

export function updateCompanyStatus(companyId: number, data: UpdateCompanyStatusRequest) {
	return request.put(`platform/companies/${companyId}/status`, { json: data }).json<RawResponse<CompanyResponse>>().then(toApiResponse);
}

export function updateCompany(companyId: number, data: CreateCompanyRequest) {
	return request.put(`platform/companies/${companyId}`, { json: data }).json<RawResponse<CompanyResponse>>().then(toApiResponse);
}

export function deleteCompany(companyId: number) {
	return request.delete(`platform/companies/${companyId}`).json<RawResponse<{ companyId: number }>>().then(toApiResponse);
}
