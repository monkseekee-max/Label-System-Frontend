import { fetchCompanyList } from "#src/api/platform/companies";
import { request } from "#src/utils/request";
import { useQuery } from "@tanstack/react-query";

/**
 * 首页 Hero 区 4 个统计数字 (全部真实, 无硬编码):
 *  - 入驻企业: GET /api/platform/companies 计数
 *  - 平台用户: GET /api/users total
 *  - 本月标注量: GET /api/label/stats qa.total
 *  - 审核通过率: qa.reviewed_ok / qa.total (除零保护 → null 显示 '-')
 *
 * 各项独立 useQuery, 互不阻塞, 各自有 loading 态. 数字加载前显示 '-'.
 */

function useCompaniesCount() {
	return useQuery({
		queryKey: ["home-hero", "companies-count"],
		queryFn: () => fetchCompanyList().then(r => (r.result ?? []).length),
	});
}

function useUsersTotal() {
	return useQuery({
		queryKey: ["home-hero", "users-total"],
		queryFn: async () => {
			// 直接调 /api/users 读 total (fetchCompanyUsers 返回数组不含 total)
			const raw = await request.get("users", { searchParams: { pageNo: 1, pageSize: 1 } }).json<{ code: number, data: { total?: number, records: unknown[] } }>();
			return raw.data?.total ?? raw.data?.records?.length ?? 0;
		},
	});
}

interface LabelStatsRaw {
	data?: { qa?: { total?: number, reviewed_ok?: number } }
}

function useLabelStats() {
	return useQuery({
		queryKey: ["home-hero", "label-stats"],
		queryFn: () => request.get("label/stats").json<LabelStatsRaw>(),
		refetchInterval: 30000,
	});
}

export interface HomeHeroStats {
	companies: number | null
	users: number | null
	annotations: number | null
	passRate: number | null // 百分比, null = 无法计算(除零)
}

export function useHomeHeroStats(): HomeHeroStats {
	const companies = useCompaniesCount();
	const users = useUsersTotal();
	const label = useLabelStats();

	const qaTotal = label.data?.data?.qa?.total ?? null;
	const qaReviewed = label.data?.data?.qa?.reviewed_ok ?? null;
	const passRate = qaTotal && qaTotal > 0 && qaReviewed != null
		? Math.round((qaReviewed / qaTotal) * 1000) / 10 // 保留 1 位小数
		: null;

	return {
		companies: companies.data ?? null,
		users: users.data ?? null,
		annotations: qaTotal,
		passRate,
	};
}
