import type { AliasRollbackResponse, CanaryRatioResponse, ModelAliasName } from "#src/api/llm-factory";
import {

	archiveModelVersion,
	discardModelVersion,
	fetchModelList,
	getModelAlias,
	getModelLifecycle,
	promoteModelVersion,
	rollbackModelAlias,
	setCanaryRatio,
	setModelAlias,
} from "#src/api/llm-factory";
import { BasicContent } from "#src/components/basic-content";
import { QueryErrorAlert } from "#src/pages/llm-factory/_shared/query-error-alert";
import { CHART_COLORS, useLlmTokens } from "#src/pages/llm-factory/_shared/theme";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Col, Popconfirm, Row, Slider, Space, Tag, Tooltip, Typography } from "antd";
import { useMemo, useState } from "react";

import { ModelContextDrawer, OperationLogDrawer } from "./lifecycle-drawers";
import { isValidLifecycleAction, lifecycleStateColor, lifecycleStateLabel } from "./lifecycle-ui";

const { Text } = Typography;

const MODEL_TYPE_COLORS: Record<string, string> = {
	TEXT_BASE: "blue",
	MULTIMODAL: "purple",
};

const MODEL_TYPE_LABELS: Record<string, string> = {
	TEXT_BASE: "文本基座",
	MULTIMODAL: "多模态",
};

const ALIAS_LABELS: Record<ModelAliasName, { text: string, color: string }> = {
	prod: { text: "PROD", color: CHART_COLORS.success },
	canary: { text: "CANARY", color: CHART_COLORS.warning },
	latest: { text: "LATEST", color: CHART_COLORS.primary },
};

interface DrawerState {
	open: boolean
	versionTag: string | null
}

function emptyDrawer(): DrawerState {
	return { open: false, versionTag: null };
}

export default function ModelManagement() {
	const token = useLlmTokens();
	const { data, error, isError, refetch } = useQuery({
		queryKey: ["llm-factory", "models"],
		queryFn: () => fetchModelList().then(r => r.result),
	});
	const [opLogDrawer, setOpLogDrawer] = useState<DrawerState>(emptyDrawer);
	const [contextDrawer, setContextDrawer] = useState<DrawerState>(emptyDrawer);

	return (
		<BasicContent>
			<div className="mb-4">
				<h2 className="m-0 text-xl font-semibold">模型管理</h2>
				<p className="mt-1 text-sm" style={{ color: token.colorTextSecondary }}>
					基座模型 + LoRA 版本管理 (lifecycle 状态机 + alias 流量调度 + 上下文回溯)。
				</p>
			</div>

			{isError && <QueryErrorAlert error={error} onRetry={() => void refetch()} title="模型列表真实接口不可用" />}

			<Row gutter={16}>
				{data?.map(model => (
					<Col span={12} key={model.id} className="mb-4">
						<ModelCard
							model={model}
							onShowOps={tag => setOpLogDrawer({ open: true, versionTag: tag })}
							onShowContext={tag => setContextDrawer({ open: true, versionTag: tag })}
						/>
					</Col>
				))}
			</Row>

			<OperationLogDrawer state={opLogDrawer} onClose={() => setOpLogDrawer(emptyDrawer())} />
			<ModelContextDrawer state={contextDrawer} onClose={() => setContextDrawer(emptyDrawer())} />
		</BasicContent>
	);
}

interface ModelCardProps {
	model: {
		id: string
		name: string
		repoPath: string
		type: "TEXT_BASE" | "MULTIMODAL"
		params: string
		diskSize: string
		track: string
		inferencePort: number
		taskCategories: string[]
		contextLength: number
		vramTotal: number
		vramUsed: number
		loraVersions: Array<{
			id: string
			tag: string
			baseModel: string
			path: string
			isActive: boolean
			createdAt: string
		}>
	}
	onShowOps: (tag: string) => void
	onShowContext: (tag: string) => void
}

function ModelCard({ model, onShowOps, onShowContext }: ModelCardProps) {
	const token = useLlmTokens();
	const queryClient = useQueryClient();
	const [canaryDraft, setCanaryDraft] = useState<number | null>(null);

	const aliases = useModelAliases(1, model.name);
	function invalidateAll() {
		queryClient.invalidateQueries({ queryKey: ["llm-factory", "models"] });
		queryClient.invalidateQueries({ queryKey: ["llm-factory", "lifecycle"] });
		queryClient.invalidateQueries({ queryKey: ["llm-factory", "alias"] });
	}

	async function handlePromote(tag: string) {
		try {
			await promoteModelVersion(tag, "pass", { actor: "admin" });
			window.$message?.success(`已晋升 ${tag} 到 PROD`);
			invalidateAll();
		}
		catch (e) {
			window.$message?.error(`晋升失败: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	async function handleArchive(tag: string) {
		try {
			await archiveModelVersion(tag, { actor: "admin", reason: "手动归档" });
			window.$message?.success(`已归档 ${tag}`);
			invalidateAll();
		}
		catch (e) {
			window.$message?.error(`归档失败: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	async function handleDiscard(tag: string) {
		try {
			await discardModelVersion(tag, { actor: "admin", reason: "训练废弃" });
			window.$message?.success(`已废弃 ${tag}`);
			invalidateAll();
		}
		catch (e) {
			window.$message?.error(`废弃失败: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	async function handleSetProd(tag: string) {
		try {
			await setModelAlias("prod", { companyId: 1, modelFamily: model.name, versionTag: tag });
			window.$message?.success(`已将 ${tag} 设为 PROD alias`);
			invalidateAll();
		}
		catch (e) {
			window.$message?.error(`设 alias 失败: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	async function handleSetCanary(tag: string) {
		try {
			await setModelAlias("canary", { companyId: 1, modelFamily: model.name, versionTag: tag });
			window.$message?.success(`已将 ${tag} 设为 CANARY alias`);
			invalidateAll();
		}
		catch (e) {
			window.$message?.error(`设 canary 失败: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	async function handleSaveCanaryRatio() {
		if (canaryDraft === null)
			return;
		try {
			const res: CanaryRatioResponse = await setCanaryRatio({
				companyId: 1,
				modelFamily: model.name,
				ratio: canaryDraft,
			});
			window.$message?.success(`CANARY 流量比例已更新为 ${(res.canaryRatio * 100).toFixed(0)}%`);
			setCanaryDraft(null);
			invalidateAll();
		}
		catch (e) {
			window.$message?.error(`设置流量比例失败: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	async function handleRollback() {
		try {
			const res: AliasRollbackResponse = await rollbackModelAlias({
				companyId: 1,
				modelFamily: model.name,
				actor: "admin",
				reason: "UI 手动回滚",
			});
			window.$message?.success(`已回滚到 ${res.version_tag}`);
			invalidateAll();
		}
		catch (e) {
			window.$message?.error(`回滚失败: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	const currentCanaryRatio = aliases.canaryRatio ?? 0;

	return (
		<Card
			style={{
				borderRadius: 12,
				border: `1px solid ${token.colorBorder}`,
			}}
		>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
				<div>
					<div className="text-base font-semibold">{model.name}</div>
					<div style={{ fontFamily: "monospace", fontSize: 12, color: token.colorTextTertiary, marginTop: 2 }}>
						{model.repoPath}
					</div>
				</div>
				<Tag color={MODEL_TYPE_COLORS[model.type]}>{MODEL_TYPE_LABELS[model.type]}</Tag>
			</div>

			<Row gutter={[8, 8]} className="mb-4">
				<Col xs={24} sm={12} lg={12}>
					<Text className="text-[11px]" style={{ color: token.colorTextTertiary }}>参数量</Text>
					<div className="font-mono text-[13px]">{model.params}</div>
				</Col>
				<Col xs={24} sm={12} lg={12}>
					<Text className="text-[11px]" style={{ color: token.colorTextTertiary }}>磁盘</Text>
					<div className="font-mono text-[13px]">{model.diskSize}</div>
				</Col>
				<Col xs={24} sm={12} lg={12}>
					<Text className="text-[11px]" style={{ color: token.colorTextTertiary }}>训练轨道</Text>
					<div className="font-mono text-[13px]">{model.track}</div>
				</Col>
				<Col xs={24} sm={12} lg={12}>
					<Text className="text-[11px]" style={{ color: token.colorTextTertiary }}>推理端口</Text>
					<div className="font-mono text-[13px]">
						:
						{model.inferencePort}
					</div>
				</Col>
				<Col xs={24} sm={12} lg={12}>
					<Text className="text-[11px]" style={{ color: token.colorTextTertiary }}>任务类型</Text>
					<div className="text-[13px]">{model.taskCategories.join(", ")}</div>
				</Col>
				<Col xs={24} sm={12} lg={12}>
					<Text className="text-[11px]" style={{ color: token.colorTextTertiary }}>上下文</Text>
					<div className="font-mono text-[13px]">{model.contextLength}</div>
				</Col>
			</Row>

			{/* Traffic routing (alias + canary + rollback) */}
			<div
				style={{
					background: token.colorFillQuaternary,
					borderRadius: 8,
					padding: 12,
					marginBottom: 16,
				}}
			>
				<div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>流量调度 (P3-3 Alias)</div>
				<Space size={8} wrap className="mb-2">
					<AliasBadge alias="prod" target={aliases.prod} />
					<AliasBadge alias="canary" target={aliases.canary} />
					<AliasBadge alias="latest" target={aliases.latest} />
				</Space>
				<div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
					<Text style={{ fontSize: 11, color: token.colorTextSecondary, flexShrink: 0 }}>CANARY 比例</Text>
					<div style={{ flex: 1, minWidth: 120 }}>
						<Slider
							min={0}
							max={100}
							step={5}
							value={(canaryDraft ?? currentCanaryRatio) * 100}
							tooltip={{ formatter: (v?: number) => `${v ?? 0}%` }}
							onChange={v => setCanaryDraft(v / 100)}
							className="m-0"
						/>
					</div>
					<Text style={{ fontSize: 12, fontFamily: "monospace", color: CHART_COLORS.warning, minWidth: 36 }}>
						{Math.round((canaryDraft ?? currentCanaryRatio) * 100)}
						%
					</Text>
					{canaryDraft !== null && (
						<Button size="small" type="primary" onClick={handleSaveCanaryRatio}>保存</Button>
					)}
					<Popconfirm title="回滚到上一 PROD 版本？" onConfirm={handleRollback}>
						<Button size="small" danger>回滚</Button>
					</Popconfirm>
				</div>
			</div>

			{/* LoRA Versions with lifecycle */}
			<div>
				<div className="text-[13px] font-semibold mb-2">LoRA 版本 (Lifecycle)</div>
				<LifecycleBatch versions={model.loraVersions} aliases={aliases} onPromote={handlePromote} onArchive={handleArchive} onDiscard={handleDiscard} onSetProd={handleSetProd} onSetCanary={handleSetCanary} onShowOps={onShowOps} onShowContext={onShowContext} />
			</div>
		</Card>
	);
}

interface AliasInfo {
	prod: string | null | undefined
	canary: string | null | undefined
	latest: string | null | undefined
	canaryRatio?: number
}

function useModelAliases(companyId: number, modelFamily: string): AliasInfo {
	const { data } = useQuery({
		queryKey: ["llm-factory", "alias", companyId, modelFamily, "all"],
		queryFn: async () => {
			const [prod, canary, latest] = await Promise.all([
				getModelAlias(companyId, modelFamily, "prod").catch(() => null),
				getModelAlias(companyId, modelFamily, "canary").catch(() => null),
				getModelAlias(companyId, modelFamily, "latest").catch(() => null),
			]);
			return { prod, canary, latest };
		},
		retry: false,
		staleTime: 30_000,
	});
	return {
		prod: data?.prod,
		canary: data?.canary,
		latest: data?.latest,
	};
}

function LifecycleBatch({ versions, aliases, ...handlers }: {
	versions: Array<{ id: string, tag: string, baseModel: string, path: string, isActive: boolean, createdAt: string }>
	aliases: AliasInfo
	onPromote: (tag: string) => void
	onArchive: (tag: string) => void
	onDiscard: (tag: string) => void
	onSetProd: (tag: string) => void
	onSetCanary: (tag: string) => void
	onShowOps: (tag: string) => void
	onShowContext: (tag: string) => void
}) {
	const lifecycleQueries = useQueries({
		queries: versions.map(v => ({
			queryKey: ["llm-factory", "lifecycle", v.tag],
			queryFn: () => getModelLifecycle(v.tag),
			retry: false,
			staleTime: 30_000,
		})),
	});
	return (
		<>
			{versions.map((lora, i) => (
				<LoRAVersionRow
					key={lora.id}
					version={lora}
					aliases={aliases}
					lifecycle={lifecycleQueries[i]?.data as { state?: string } | undefined}
					lifecycleError={lifecycleQueries[i]?.isError}
					{...handlers}
				/>
			))}
		</>
	);
}

function AliasBadge({ alias, target }: { alias: ModelAliasName, target: string | null | undefined }) {
	const cfg = ALIAS_LABELS[alias];
	if (!target) {
		return (
			<Tag style={{ opacity: 0.5, borderColor: cfg.color, color: cfg.color }}>
				{cfg.text}
				: 未设置
			</Tag>
		);
	}
	return (
		<Tag color={cfg.color}>
			{cfg.text}
			:
			<span className="font-mono">{target}</span>
		</Tag>
	);
}

interface LoRAVersionRowProps {
	version: {
		id: string
		tag: string
		baseModel: string
		path: string
		isActive: boolean
		createdAt: string
	}
	aliases: AliasInfo
	lifecycle?: { state?: string }
	lifecycleError?: boolean
	onPromote: (tag: string) => void
	onArchive: (tag: string) => void
	onDiscard: (tag: string) => void
	onSetProd: (tag: string) => void
	onSetCanary: (tag: string) => void
	onShowOps: (tag: string) => void
	onShowContext: (tag: string) => void
}

function LoRAVersionRow({
	version,
	aliases,
	lifecycle,
	lifecycleError,
	onPromote,
	onArchive,
	onDiscard,
	onSetProd,
	onSetCanary,
	onShowOps,
	onShowContext,
}: LoRAVersionRowProps) {
	const token = useLlmTokens();

	const state = lifecycle?.state;
	const isProd = aliases.prod === version.tag;
	const isCanary = aliases.canary === version.tag;
	const isLatest = aliases.latest === version.tag;

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "12px 0",
				borderBottom: `1px solid ${token.colorBorderSecondary}`,
				flexWrap: "wrap",
			}}
		>
			<span style={{ fontFamily: "monospace", fontSize: 12, color: CHART_COLORS.primary, minWidth: 160 }}>
				{version.tag}
			</span>

			<Tag color={lifecycleStateColor(state)}>
				{lifecycleError ? "未注册" : lifecycleStateLabel(state)}
			</Tag>

			{isProd && <Tag color={CHART_COLORS.success}>PROD</Tag>}
			{isCanary && <Tag color={CHART_COLORS.warning}>CANARY</Tag>}
			{isLatest && <Tag color={CHART_COLORS.primary}>LATEST</Tag>}

			<Space size={4} className="ml-auto">
				<Tooltip title="设为 PROD alias">
					<Button
						size="small"
						disabled={isProd || state === "archived" || state === "discarded"}
						onClick={() => onSetProd(version.tag)}
					>
						设 PROD
					</Button>
				</Tooltip>
				<Tooltip title="设为 CANARY alias">
					<Button
						size="small"
						disabled={isCanary || state === "archived" || state === "discarded"}
						onClick={() => onSetCanary(version.tag)}
					>
						设 CANARY
					</Button>
				</Tooltip>
				{isValidLifecycleAction(state, "promote") && (
					<Popconfirm title="晋升到 PROD？(需门禁通过)" onConfirm={() => onPromote(version.tag)}>
						<Button size="small" type="primary">晋升</Button>
					</Popconfirm>
				)}
				{isValidLifecycleAction(state, "archive") && (
					<Popconfirm title="归档此版本？" onConfirm={() => onArchive(version.tag)}>
						<Button size="small">归档</Button>
					</Popconfirm>
				)}
				{isValidLifecycleAction(state, "discard") && (
					<Popconfirm title="废弃此版本？不可恢复" onConfirm={() => onDiscard(version.tag)}>
						<Button size="small" danger>废弃</Button>
					</Popconfirm>
				)}
				<Button size="small" type="link" onClick={() => onShowOps(version.tag)}>
					操作日志
				</Button>
				<Button size="small" type="link" onClick={() => onShowContext(version.tag)}>
					上下文
				</Button>
			</Space>
		</div>
	);
}
