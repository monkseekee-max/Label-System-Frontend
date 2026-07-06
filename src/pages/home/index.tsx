import type { BackendUserPosition } from "#src/api/user";
import { BasicContent } from "#src/components/basic-content";
import { useHomeHeroStats } from "#src/hooks/use-home-stats";
import { OpsBoardView } from "#src/pages/llm-factory/overview/ops-board/ops-board-view";
import { useUserStore } from "#src/store/user";
import {
	AppstoreOutlined,
	BankOutlined,
	DatabaseOutlined,
	EditOutlined,
	HomeOutlined,
	LineChartOutlined,
	RocketOutlined,
} from "@ant-design/icons";
import { Card, Tabs, theme, Typography } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

interface ModuleItem {
	key: string
	title: string
	description: string
	path: string
	icon: React.ReactNode
	iconBg: string
	iconColor: string
	positions: BackendUserPosition[]
	pages: string
}

// eslint-disable-next-line react-refresh/only-export-components -- 导出供权限单测引用, 验证首页卡片 path 与角色一致性 (无 403 死链)
export const MODULE_LIST: ModuleItem[] = [
	{
		key: "home",
		title: "首页仪表盘",
		description: "数据概览、统计图表、平台运行状态、快捷入口。",
		path: "/home",
		icon: <HomeOutlined />,
		iconBg: "rgba(22,93,255,0.08)",
		iconColor: "#165DFF",
		positions: ["SUPER_ADMIN", "ADMIN", "ANNOTATOR", "DATA_TRAINER", "REVIEWER"],
		pages: "首页",
	},
	{
		key: "enterprise",
		title: "企业",
		description: "企业管理、人员与角色、系统配置、计费中心、基础设施与运维安全。",
		path: "/platform/companies",
		icon: <BankOutlined />,
		iconBg: "rgba(82,196,26,0.08)",
		iconColor: "#52c41a",
		positions: ["SUPER_ADMIN"],
		pages: "12 个页面",
	},
	{
		key: "data",
		title: "数据",
		description: "数据概览、标注源资料上传与入库、训练数据集、任务类型。数据资产全生命周期。",
		path: "/label-system/dashboard",
		icon: <DatabaseOutlined />,
		iconBg: "rgba(236,72,153,0.08)",
		iconColor: "#EC4899",
		positions: ["SUPER_ADMIN", "ADMIN", "DATA_TRAINER"],
		pages: "6 个页面",
	},
	{
		key: "annotation",
		title: "标注",
		description: "文本/图片/视频标注闭环、智能引擎主动学习与语义验证、质量评估与对齐分析。",
		path: "/label-system/data-annotation",
		icon: <EditOutlined />,
		iconBg: "rgba(217,119,6,0.08)",
		iconColor: "#D97706",
		positions: ["SUPER_ADMIN", "ADMIN", "ANNOTATOR", "REVIEWER"],
		pages: "4 个页面",
	},
	{
		key: "training",
		title: "训练",
		description: "训练管线、训练任务、模型仓库与模型中心。标注数据汇集成数据集驱动模型迭代。",
		path: "/label-system/training-pipeline",
		icon: <RocketOutlined />,
		iconBg: "rgba(22,93,255,0.08)",
		iconColor: "#165DFF",
		positions: ["SUPER_ADMIN", "ADMIN", "DATA_TRAINER"],
		pages: "6 个页面",
	},
	{
		key: "application",
		title: "应用",
		description: "模型推理服务、智能问答、应用运行看板。模型服务化与业务落地。",
		path: "/llm-factory/model/inference",
		icon: <AppstoreOutlined />,
		iconBg: "rgba(99,102,241,0.08)",
		iconColor: "#6366F1",
		positions: ["SUPER_ADMIN", "ADMIN", "DATA_TRAINER"],
		pages: "2 个页面",
	},
];

function getRoleLabel(position?: BackendUserPosition): string {
	switch (position) {
		case "SUPER_ADMIN":
			return "超管";
		case "ADMIN":
			return "管理员";
		case "ANNOTATOR":
			return "标注员";
		case "DATA_TRAINER":
			return "训练师";
		case "REVIEWER":
			return "审核员";
		default:
			return "用户";
	}
}

function getWelcomeDesc(position?: BackendUserPosition): string {
	switch (position) {
		case "SUPER_ADMIN":
			return "知识图谱智能标注平台 — 超管视角。管理所有企业、人员、资料、任务、审批与归档流程。";
		case "ADMIN":
			return "知识图谱智能标注平台 — 管理员视角。管理人员、资料、任务、审批与归档流程。";
		case "REVIEWER":
			return "知识图谱智能标注平台 — 审核员视角。负责标注结果的人工审核与比对，确保数据质量。";
		case "DATA_TRAINER":
			return "知识图谱智能标注平台 — 训练师视角。负责上传资料、执行标注任务与模型训练。";
		case "ANNOTATOR":
		default:
			return "知识图谱智能标注平台 — 标注员视角。负责上传资料与执行标注任务。";
	}
}

export default function Home() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const position = useUserStore(s => s.position);
	const { token } = theme.useToken();
	const [activeTab, setActiveTab] = useState("ops");

	const visibleModules = useMemo(() => {
		if (!position)
			return MODULE_LIST;
		return MODULE_LIST.filter(m => m.positions.includes(position));
	}, [position]);

	const roleLabel = getRoleLabel(position);
	const welcomeDesc = getWelcomeDesc(position);
	const hero = useHomeHeroStats();

	return (
		<BasicContent className="space-y-6">
			{/* Welcome Hero */}
			<div
				style={{
					background: "linear-gradient(135deg, #165DFF 0%, #3C7EFF 100%)",
					borderRadius: 16,
					padding: "32px 40px",
					color: "#fff",
				}}
			>
				<Typography.Title level={3} style={{ color: "#fff", marginBottom: 8, marginTop: 0 }}>
					{t("authority.pageTitle")}
				</Typography.Title>
				<Typography.Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, display: "block", maxWidth: 600, lineHeight: 1.6 }}>
					{welcomeDesc}
				</Typography.Text>
				<div style={{ display: "flex", gap: 48, marginTop: 28, flexWrap: "wrap" }}>
					<div className="text-center">
						<div className="text-[36px] font-bold font-mono [font-variant-numeric:tabular-nums]">
							{hero.companies ?? "-"}
						</div>
						<div className="text-sm opacity-75 mt-1">入驻企业</div>
					</div>
					<div className="text-center">
						<div className="text-[36px] font-bold font-mono [font-variant-numeric:tabular-nums]">
							{hero.users ?? "-"}
						</div>
						<div className="text-sm opacity-75 mt-1">平台用户</div>
					</div>
					<div className="text-center">
						<div className="text-[36px] font-bold font-mono [font-variant-numeric:tabular-nums]">
							{hero.annotations ?? "-"}
						</div>
						<div className="text-sm opacity-75 mt-1">标注项</div>
					</div>
					<div className="text-center">
						<div className="text-[36px] font-bold font-mono [font-variant-numeric:tabular-nums]">
							{hero.passRate == null ? "-" : hero.passRate}
							{hero.passRate != null && <span style={{ fontSize: 22, opacity: 0.7 }}>%</span>}
						</div>
						<div className="text-sm opacity-75 mt-1">审核通过率</div>
					</div>
				</div>
			</div>

			{/* Tabs: 运营看板 (集成自 /llm-factory/overview/ops-board) + 功能模块导航 */}
			<Tabs
				activeKey={activeTab}
				onChange={setActiveTab}
				items={[
					{
						key: "ops",
						label: (
							<span>
								<LineChartOutlined />
								运营看板
							</span>
						),
						children: <OpsBoardView showHeader={false} />,
					},
					{
						key: "modules",
						label: (
							<span>
								<AppstoreOutlined />
								功能模块
							</span>
						),
						children: (
							<>
								<Typography.Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
									点击任意模块进入对应管理页面。当前身份：
									{roleLabel}
								</Typography.Text>
								<div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
									{visibleModules.map(module => (
										<Card
											key={module.key}
											hoverable
											onClick={() => void navigate(module.path)}
											style={{
												cursor: "pointer",
												borderRadius: 16,
												transition: "all 0.2s ease",
											}}
											styles={{ body: { padding: 24 } }}
										>
											<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
												<div
													style={{
														width: 48,
														height: 48,
														borderRadius: 12,
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
														marginBottom: 16,
														background: module.iconBg,
														color: module.iconColor,
														fontSize: 20,
													}}
												>
													{module.icon}
												</div>
												<div style={{ fontSize: 16, fontWeight: 600, color: token.colorText, marginBottom: 8 }}>
													{module.title}
												</div>
												<div style={{ fontSize: 14, color: token.colorTextSecondary, lineHeight: 1.6, flex: 1 }}>
													{module.description}
												</div>
												<div
													style={{
														display: "flex",
														alignItems: "center",
														gap: 12,
														marginTop: 16,
														paddingTop: 16,
														borderTop: `1px solid ${token.colorBorderSecondary}`,
													}}
												>
													<span style={{ fontSize: 12, color: token.colorTextSecondary }}>{module.pages}</span>
													<span
														style={{
															fontSize: 12,
															padding: "2px 8px",
															borderRadius: 4,
															background: token.colorPrimaryBg,
															color: token.colorPrimary,
														}}
													>
														{module.positions.length >= 5 ? "全部角色" : module.positions.map(getRoleLabel).join(" / ")}
													</span>
												</div>
											</div>
										</Card>
									))}
								</div>
							</>
						),
					},
				]}
			/>
		</BasicContent>
	);
}
