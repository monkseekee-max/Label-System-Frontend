import { useAuthStore } from "#src/store/auth";
/**
 * 公共官网首页 (生产级 landing page)
 *
 * 访客进入系统首先看到的营销/介绍页.
 * 无需登录, 包含:
 * - 导航栏 (锚点导航 + 登录态感知 CTA)
 * - Hero 区 (主标题 + CTA + 终端演示 + 渐变光场)
 * - 统计数据
 * - 数据飞轮可视化 (环形闭环 · 签名视觉)
 * - 核心能力卡片
 * - 工作流深度展示
 * - 技术分层架构
 * - 能力对比 / 常见问题 FAQ
 * - 行动召唤
 *
 * 已登录用户: 主 CTA 切换为"进入控制台", 不再误导向后台.
 */
import {
	ApiOutlined,
	ArrowRightOutlined,
	BlockOutlined,
	BranchesOutlined,
	CheckCircleFilled,
	CloseOutlined,
	CodeSandboxOutlined,
	ControlOutlined,
	DeploymentUnitOutlined,
	ExperimentOutlined,
	EyeOutlined,
	FileTextOutlined,
	GithubOutlined,
	LineChartOutlined,
	MenuOutlined,
	PlayCircleOutlined,
	PlaySquareFilled,
	QuestionCircleOutlined,
	RocketOutlined,
	SafetyCertificateOutlined,
	ThunderboltOutlined,
	ToolOutlined,
} from "@ant-design/icons";
import { Button, Collapse, Drawer, Typography } from "antd";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { ARCH_LAYERS, C, FAQ_ITEMS, FEATURES, FONT, NAV_LINKS, STATS, WHY_ROWS, WORKFLOW_STEPS } from "./data";
import { Flywheel } from "./flywheel";
import { SectionHeading } from "./section-heading";
import { TerminalMockup } from "./terminal-mockup";

const { Title, Paragraph } = Typography;

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */
export default function LandingPage() {
	const navigate = useNavigate();
	const isLogin = useAuthStore(state => Boolean(state.token));
	const [activeLayer, setActiveLayer] = useState(0);
	const [scrolled, setScrolled] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 80);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const scrollTo = (href: string) => {
		document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
		setMobileOpen(false);
	};

	return (
		<div className="landing" style={{ background: C.bg, fontFamily: FONT, color: C.ink }}>
			<style>
				{`
				@keyframes spin-slow { to { transform: rotate(360deg); } }
				.landing, .landing .ant-typography, .landing .ant-btn, .landing .ant-collapse { font-family: ${FONT} !important; }
				.landing nav .nav-text-btn { background: transparent; border: none; }
				.landing .feat-card .feat-bar {
					position: absolute; left: 0; right: 0; top: 0; height: 3px;
					background: linear-gradient(90deg, ${C.brand}, ${C.accent});
					transform: scaleX(0); transform-origin: left; transition: transform .3s ease;
				}
				.landing .feat-card:hover .feat-bar { transform: scaleX(1); }
			`}
			</style>

			{/* ---------- Navigation ---------- */}
			<nav className="fixed left-0 right-0 top-0 z-50">
				<motion.div
					initial={false}
					animate={{
						maxWidth: scrolled ? 1100 : 1280,
						marginTop: scrolled ? 8 : 0,
						opacity: 1,
					}}
					transition={{ duration: 0.3, ease: "easeOut" }}
					className="mx-auto px-4"
					style={{ width: "100%" }}
				>
					<div
						className="mx-auto flex items-center justify-between px-5 transition-all duration-300"
						style={{
							height: scrolled ? 56 : 64,
							borderRadius: scrolled ? 16 : 0,
							background: scrolled ? "rgba(255,255,255,0.92)" : C.ink,
							borderBottom: scrolled ? "none" : "1px solid rgba(255,255,255,0.06)",
							boxShadow: scrolled ? "0 10px 40px -12px rgba(15,23,42,0.12)" : "none",
						}}
					>
						{/* Logo */}
					<button
							type="button"
							className="nav-text-btn flex items-center gap-2.5"
							onClick={() => scrollTo("#top")}
						>
							<span
								className="flex items-center justify-center rounded-xl"
								style={{
									width: 34, height: 34,
									background: `linear-gradient(135deg, ${C.brand} 0%, ${C.violet} 100%)`,
									color: "#fff",
									boxShadow: scrolled ? `0 4px 12px ${C.brand}44` : "0 4px 16px rgba(79,70,229,0.4)",
								}}
							>
								<ExperimentOutlined style={{ fontSize: 18 }} />
							</span>
							<span
								className="hidden font-bold tracking-tight sm:block"
								style={{
									color: scrolled ? C.ink : "#fff",
									fontSize: 16,
									letterSpacing: "-0.02em",
								}}
							>
								LLM Factory
							</span>
						</button>

						{/* Desktop nav links */}
						<div className="hidden items-center gap-1 lg:flex">
							{NAV_LINKS.map(link => (
								<button
									key={link.href}
									type="button"
									onClick={() => scrollTo(link.href)}
									className="nav-text-btn rounded-full px-4 py-2 text-sm font-medium transition-all duration-200"
									style={{
										color: scrolled ? C.muted : "rgba(255,255,255,0.9)",
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.color = scrolled ? C.ink : "#fff";
										e.currentTarget.style.background = scrolled ? C.bgTint : "rgba(255,255,255,0.12)";
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.color = scrolled ? C.muted : "rgba(255,255,255,0.9)";
										e.currentTarget.style.background = "transparent";
									}}
								>
									{link.label}
								</button>
							))}
						</div>

						{/* Right actions */}
						<div className="flex items-center gap-2">
							{isLogin
								? (
									<button
										type="button"
										onClick={() => navigate(import.meta.env.VITE_BASE_HOME_PATH)}
										className="flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 hover:scale-105"
										style={{
											background: `linear-gradient(135deg, ${C.brand}, ${C.violet})`,
											color: "#fff",
											boxShadow: `0 4px 14px ${C.brand}55`,
										}}
									>
										进入控制台
										<ArrowRightOutlined style={{ fontSize: 12 }} />
									</button>
								)
								: (
									<>
										<button
											type="button"
											onClick={() => navigate("/login")}
											className="nav-text-btn hidden rounded-full px-4 py-2 text-sm font-medium transition-colors sm:block"
									style={{
											color: scrolled ? C.muted : "rgba(255,255,255,0.9)",
										}}
										onMouseEnter={(e) => { e.currentTarget.style.color = scrolled ? C.ink : "#fff"; }}
										onMouseLeave={(e) => { e.currentTarget.style.color = scrolled ? C.muted : "rgba(255,255,255,0.9)"; }}
										>
											登录
										</button>
										<button
											type="button"
											onClick={() => navigate("/login?mode=register")}
											className="flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 hover:scale-105"
											style={{
												background: `linear-gradient(135deg, ${C.brand}, ${C.violet})`,
												color: "#fff",
												boxShadow: `0 4px 14px ${C.brand}55`,
											}}
										>
											免费开始
											<ArrowRightOutlined style={{ fontSize: 12 }} />
										</button>
									</>
								)}

							{/* Mobile hamburger */}
							<button
								type="button"
								onClick={() => setMobileOpen(true)}
								className="nav-text-btn flex items-center justify-center rounded-lg lg:hidden"
								style={{
									width: 36, height: 36,
									color: scrolled ? C.ink : "#fff",
									background: scrolled ? "transparent" : "rgba(255,255,255,0.08)",
								}}
							>
								<MenuOutlined style={{ fontSize: 18 }} />
							</button>
						</div>
					</div>
				</motion.div>
			</nav>

			{/* Mobile drawer */}
			<Drawer
				title={null}
				open={mobileOpen}
				onClose={() => setMobileOpen(false)}
				placement="right"
				width={280}
				styles={{ body: { padding: 0 } }}
				closeIcon={null}
			>
				<div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
					<span className="flex items-center gap-2 font-bold" style={{ color: C.ink, fontSize: 16 }}>
						<ExperimentOutlined style={{ color: C.brand }} />
						LLM Factory
					</span>
					<button type="button" onClick={() => setMobileOpen(false)} className="text-xl" style={{ color: C.muted }}>
						<CloseOutlined />
					</button>
				</div>
				<div className="flex flex-col py-2">
					{NAV_LINKS.map(link => (
						<button
							key={link.href}
							type="button"
							onClick={() => scrollTo(link.href)}
							className="px-5 py-3 text-left text-sm font-medium transition-colors hover:bg-gray-50"
							style={{ color: C.ink2 }}
						>
							{link.label}
						</button>
					))}
					<div className="mt-2 flex flex-col gap-2 px-5">
						{isLogin
							? (
								<button
									type="button"
									onClick={() => { setMobileOpen(false); navigate(import.meta.env.VITE_BASE_HOME_PATH); }}
									className="rounded-xl px-4 py-2.5 text-center text-sm font-semibold"
									style={{ background: `linear-gradient(135deg, ${C.brand}, ${C.violet})`, color: "#fff" }}
								>
									进入控制台
								</button>
							)
							: (
								<>
									<button
										type="button"
										onClick={() => { setMobileOpen(false); navigate("/login"); }}
										className="rounded-xl border px-4 py-2.5 text-center text-sm font-semibold"
										style={{ borderColor: C.line, color: C.ink }}
									>
										登录
									</button>
									<button
										type="button"
										onClick={() => { setMobileOpen(false); navigate("/login?mode=register"); }}
										className="rounded-xl px-4 py-2.5 text-center text-sm font-semibold"
										style={{ background: `linear-gradient(135deg, ${C.brand}, ${C.violet})`, color: "#fff" }}
									>
										免费开始
									</button>
								</>
							)}
					</div>
				</div>
			</Drawer>

			{/* ---------- Hero ---------- */}
			<section
				id="top"
				className="relative overflow-hidden"
				style={{ paddingTop: 140, paddingBottom: 100, background: `linear-gradient(180deg, ${C.ink} 0%, ${C.ink2} 40%, ${C.bgSoft} 100%)` }}
			>
				{/* gradient light-field background */}
				<div
					className="absolute inset-0"
					style={{
						backgroundImage:
							`radial-gradient(900px 480px at 12% -8%, ${C.brand}40, transparent 60%),`
							+ `radial-gradient(820px 520px at 92% 8%, ${C.violet}30, transparent 55%),`
							+ `radial-gradient(700px 600px at 50% 120%, ${C.accent}20, transparent 60%)`,
					}}
				/>
				{/* fine grid overlay */}
				<div
					className="absolute inset-0 opacity-[0.3]"
					style={{
						backgroundImage:
							`linear-gradient(${C.line}25 1px, transparent 1px), linear-gradient(90deg, ${C.line}25 1px, transparent 1px)`,
						backgroundSize: "56px 56px",
						maskImage: "radial-gradient(620px 520px at 50% 30%, #000 30%, transparent 80%)",
						WebkitMaskImage: "radial-gradient(620px 520px at 50% 30%, #000 30%, transparent 80%)",
					}}
				/>

				<div className="relative mx-auto max-w-6xl px-6">
					<div className="grid items-center gap-12 lg:grid-cols-2">
						<div>
							<motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
								<span
									className="mb-6 inline-flex items-center gap-2 rounded-full"
									style={{ background: "rgba(255,255,255,0.08)", border: `1px solid rgba(255,255,255,0.12)`, padding: "6px 14px 6px 8px", backdropFilter: "blur(8px)" }}
								>
									<span
										className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
										style={{ background: `${C.brand}40`, color: "#A5B4FC", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}
									>
										<RocketOutlined />
										NEW
									</span>
									<span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13.5, fontWeight: 500 }}>
										开源 · 端到端 · 大模型训练工厂
									</span>
								</span>

								<Title
									level={1}
									style={{
										fontSize: "clamp(2.5rem, 6vw, 4rem)",
										fontWeight: 900,
										lineHeight: 1.08,
										letterSpacing: "-0.03em",
										margin: "0 0 24px",
										color: "#fff",
									}}
								>
									从数据到模型
									<br />
									<span style={{ background: `linear-gradient(120deg, ${C.accent} 0%, ${C.violet} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
										一站式闭环
									</span>
								</Title>

								<Paragraph
									style={{
										fontSize: "clamp(1.02rem, 1.5vw, 1.2rem)",
										color: "rgba(255,255,255,0.6)",
										maxWidth: 560,
										margin: "0 0 32px",
										lineHeight: 1.75,
									}}
								>
									标注管理 · 数据集构建 · LoRA 微调 · vLLM 推理 · 自动评测 · 质量门禁
									<br />
									完整数据飞轮，让模型越用越聪明
								</Paragraph>

								<div className="flex flex-wrap gap-3">
									{isLogin
										? (
											<Button
												type="primary"
												size="large"
												onClick={() => navigate(import.meta.env.VITE_BASE_HOME_PATH)}
												style={{ height: 52, paddingInline: 30, fontSize: 16, borderRadius: 12, fontWeight: 600, background: `linear-gradient(135deg, ${C.brand}, ${C.violet})`, border: "none" }}
											>
												进入控制台
												<ArrowRightOutlined />
											</Button>
										)
										: (
											<Button
												type="primary"
												size="large"
												onClick={() => navigate("/login?mode=register")}
												style={{ height: 52, paddingInline: 30, fontSize: 16, borderRadius: 12, fontWeight: 600, background: `linear-gradient(135deg, ${C.brand}, ${C.violet})`, border: "none" }}
											>
												立即体验
												<ArrowRightOutlined />
											</Button>
										)}
									<Button
										size="large"
										icon={<PlayCircleOutlined />}
										onClick={() => scrollTo("#workflow")}
										style={{ height: 52, paddingInline: 26, fontSize: 16, borderRadius: 12, fontWeight: 600, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}
									>
										查看工作流
									</Button>
								</div>

								{/* trust row */}
								<div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2" style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
									<span className="inline-flex items-center gap-1.5">
										<CheckCircleFilled style={{ color: C.success }} />
										{" "}
										开源架构
									</span>
									<span className="inline-flex items-center gap-1.5">
										<CheckCircleFilled style={{ color: C.success }} />
										{" "}
										零云依赖
									</span>
									<span className="inline-flex items-center gap-1.5">
										<CheckCircleFilled style={{ color: C.success }} />
										{" "}
										Qwen3 · LoRA · vLLM
									</span>
								</div>
							</motion.div>
						</div>

						<motion.div
							initial={{ opacity: 0, scale: 0.96, y: 14 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							transition={{ duration: 0.6, delay: 0.15 }}
						>
							<TerminalMockup />
						</motion.div>
					</div>

					{/* stats */}
					<motion.div
						className="mx-auto mt-20 grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4"
						initial={{ opacity: 0, y: 18 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.3 }}
					>
						{STATS.map(stat => (
							<div
								key={stat.label}
								className="rounded-2xl p-6 text-center"
								style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}
							>
								<div style={{ fontSize: 34, fontWeight: 900, color: "#fff", fontFamily: "'Inter',monospace", letterSpacing: "-0.02em" }}>
									{stat.value}
								</div>
								<div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>{stat.label}</div>
							</div>
						))}
					</motion.div>
				</div>
			</section>

			{/* ---------- Data flywheel ---------- */}
			<section className="relative scroll-mt-20 py-24">
				<div className="mx-auto max-w-5xl px-6">
					<SectionHeading
						eyebrow="Core Loop"
						title="数据飞轮 · 越转越快"
						subtitle="每一次推理产生的新数据，都会回流到标注池，驱动下一轮训练。闭环即增长。"
					/>
					<Flywheel />
				</div>
			</section>

			{/* ---------- Features ---------- */}
			<section id="features" className="scroll-mt-20 py-24" style={{ background: C.bgSoft }}>
				<div className="mx-auto max-w-6xl px-6">
					<SectionHeading
						eyebrow="Features"
						title="六大核心能力"
						subtitle="覆盖大模型训练全生命周期的每一个环节，工程化、可度量、可治理。"
					/>
					<div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
						{FEATURES.map((feature, i) => (
							<motion.div
								key={feature.title}
								className="feat-card relative overflow-hidden rounded-2xl p-7"
								style={{ background: "#fff", border: `1px solid ${C.line}` }}
								initial={{ opacity: 0, y: 18 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true, margin: "-60px" }}
								transition={{ delay: i * 0.05, duration: 0.4 }}
								whileHover={{ y: -6, boxShadow: `0 18px 40px ${C.brand}1A` }}
							>
								<span className="feat-bar" aria-hidden />
								<div
									className="mb-5 flex items-center justify-center rounded-2xl"
									style={{
										width: 56,
										height: 56,
										background: C.brandSoft,
										color: C.brand,
										fontSize: 24,
										transition: "all .3s",
									}}
								>
									{feature.icon}
								</div>
								<h3 style={{ fontSize: 19, fontWeight: 700, color: C.ink, margin: "0 0 10px", letterSpacing: "-0.01em" }}>
									{feature.title}
								</h3>
								<p style={{ color: C.muted, lineHeight: 1.7, fontSize: 14.5, margin: 0 }}>{feature.desc}</p>
							</motion.div>
						))}
					</div>
				</div>
			</section>

			{/* ---------- Workflow ---------- */}
			<section id="workflow" className="scroll-mt-20 py-24">
				<div className="mx-auto max-w-6xl px-6">
					<SectionHeading
						eyebrow="Workflow"
						title="四步打造你的领域大模型"
						subtitle="从原始资料到生产级推理服务，全流程自动化，每一步都可观测、可回滚。"
					/>
					<div className="relative grid gap-5 md:grid-cols-2 lg:grid-cols-4">
						{/* connecting line on desktop */}
						<div
							className="absolute hidden lg:block"
							style={{
								top: 28,
								left: "12.5%",
								right: "12.5%",
								height: 2,
								background: `linear-gradient(90deg, ${C.line}, ${C.brand}55, ${C.line})`,
							}}
						/>
						{WORKFLOW_STEPS.map((step, i) => (
							<motion.div
								key={step.title}
								className="relative rounded-2xl p-6"
								style={{ background: "#fff", border: `1px solid ${C.line}`, boxShadow: "0 4px 16px rgba(22,93,255,0.04)" }}
								initial={{ opacity: 0, y: 18 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{ delay: i * 0.08 }}
							>
								<div className="mb-4 flex items-center justify-between">
									<span
										className="flex h-12 w-12 items-center justify-center rounded-full text-base font-extrabold"
										style={{ background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)`, color: "#fff", boxShadow: `0 6px 16px ${C.brand}44`, position: "relative", zIndex: 1 }}
									>
										{i + 1}
									</span>
									<ArrowRightOutlined style={{ color: C.mutedSoft, opacity: i === WORKFLOW_STEPS.length - 1 ? 0 : 1 }} />
								</div>
								<h4 style={{ fontSize: 16.5, fontWeight: 700, color: C.ink, margin: "0 0 8px" }}>{step.title}</h4>
								<p style={{ color: C.muted, fontSize: 14, lineHeight: 1.65, margin: 0 }}>{step.desc}</p>
							</motion.div>
						))}
					</div>
				</div>
			</section>

			{/* ---------- Architecture ---------- */}
			<section id="architecture" className="scroll-mt-20 py-24" style={{ background: C.bgSoft }}>
				<div className="mx-auto max-w-5xl px-6">
					<SectionHeading
						eyebrow="Architecture"
						title="工程级架构"
						subtitle="笔记本友好，服务器可迁移，架构零改动。三平面解耦，职责清晰。"
					/>
					<div className="mx-auto flex max-w-2xl flex-col gap-4">
						{ARCH_LAYERS.map((layer, i) => {
							const active = activeLayer === i;
							return (
								<motion.div
									key={layer.name}
									className="overflow-hidden rounded-2xl"
									style={{
										border: `1.5px solid ${active ? C.brand : C.line}`,
										boxShadow: active ? `0 10px 30px ${C.brand}1F` : "none",
										background: "#fff",
									}}
									initial={{ opacity: 0, y: 18 }}
									whileInView={{ opacity: 1, y: 0 }}
									viewport={{ once: true }}
									transition={{ delay: i * 0.08 }}
									onMouseEnter={() => setActiveLayer(i)}
								>
									<div className="flex items-center justify-between px-6 py-5">
										<div className="flex items-center gap-3.5">
											<span
												className="flex h-11 w-11 items-center justify-center rounded-xl"
												style={{ background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)`, color: "#fff", fontSize: 19 }}
											>
												{layer.icon}
											</span>
											<span style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{layer.name}</span>
										</div>
										<DeploymentUnitOutlined style={{ color: active ? C.brand : C.mutedSoft, fontSize: 22 }} />
									</div>
									<div className="flex flex-wrap gap-2 px-6 pb-5">
										{layer.items.map(item => (
											<span
												key={item}
												className="inline-flex items-center rounded-lg"
												style={{ background: C.brandSoft, color: C.brandDark, padding: "4px 12px", fontSize: 13, fontWeight: 500 }}
											>
												{item}
											</span>
										))}
									</div>
								</motion.div>
							);
						})}
					</div>

					<div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-3">
						{[
							{ num: "754", label: "单元测试全绿", icon: <SafetyCertificateOutlined /> },
							{ num: "18", label: "ADR 架构决策", icon: <BranchesOutlined /> },
							{ num: "3", label: "平面模块解耦", icon: <BlockOutlined /> },
						].map(item => (
							<div
								key={item.label}
								className="flex items-center gap-4 rounded-2xl p-5"
								style={{ background: "#fff", border: `1px solid ${C.line}` }}
							>
								<span className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: C.brandSoft, color: C.brand, fontSize: 20 }}>
									{item.icon}
								</span>
								<div>
									<div style={{ fontSize: 26, fontWeight: 900, color: C.brand, fontFamily: "'Inter',monospace", letterSpacing: "-0.02em" }}>{item.num}</div>
									<div style={{ fontSize: 13, color: C.muted }}>{item.label}</div>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ---------- Why us / comparison ---------- */}
			<section className="py-24">
				<div className="mx-auto max-w-4xl px-6">
					<SectionHeading eyebrow="Why Us" title="为什么选择 LLM Factory" subtitle="不是 Demo 拼装，是经过 754 项测试与 ADR 治理的生产级工程。" />
					<div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${C.line}`, background: "#fff" }}>
						{WHY_ROWS.map((row, i) => (
							<div
								key={row}
								className="flex items-center gap-4 px-6 py-4"
								style={{ background: i % 2 ? C.bgSoft : "#fff", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}
							>
								<span
									className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
									style={{ background: `${C.success}1A`, color: C.success }}
								>
									<CheckCircleFilled style={{ fontSize: 15 }} />
								</span>
								<span style={{ color: C.ink2, fontSize: 15.5, fontWeight: 500 }}>{row}</span>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ---------- FAQ ---------- */}
			<section id="faq" className="scroll-mt-20 py-24" style={{ background: C.bgSoft }}>
				<div className="mx-auto max-w-3xl px-6">
					<SectionHeading eyebrow="FAQ" title="常见问题" />
					<Collapse
						items={FAQ_ITEMS}
						defaultActiveKey={["1"]}
						className="rounded-2xl"
						style={{ background: "#fff", border: `1px solid ${C.line}` }}
					/>
				</div>
			</section>

			{/* ---------- CTA ---------- */}
			<section className="py-24">
				<div className="mx-auto max-w-5xl px-6">
					<motion.div
						className="relative overflow-hidden rounded-3xl px-8 py-16 text-center"
						style={{ background: `linear-gradient(120deg, ${C.ink} 0%, ${C.brandDark} 50%, ${C.violet} 100%)` }}
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
					>
						<div
							className="absolute inset-0 opacity-30"
							style={{
								backgroundImage:
									"radial-gradient(600px 300px at 20% 0%, rgba(255,255,255,0.25), transparent 60%), radial-gradient(500px 300px at 90% 100%, rgba(255,255,255,0.18), transparent 60%)",
							}}
						/>
						<div className="relative">
							<PlaySquareFilled style={{ fontSize: 40, color: "rgba(255,255,255,0.9)" }} />
							<Title level={2} style={{ color: "#fff", fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)", fontWeight: 800, margin: "16px 0 12px", letterSpacing: "-0.02em" }}>
								开启你的大模型训练之旅
							</Title>
							<Paragraph style={{ color: "rgba(255,255,255,0.88)", fontSize: 17, marginBottom: 36, maxWidth: 520, marginInline: "auto" }}>
								注册即可使用全部功能，数据飞轮即刻转动。
							</Paragraph>
							{isLogin
								? (
									<Button
										size="large"
										icon={<RocketOutlined />}
										onClick={() => navigate(import.meta.env.VITE_BASE_HOME_PATH)}
										style={{ height: 54, paddingInline: 40, fontSize: 16, borderRadius: 12, background: "#fff", border: "none", color: C.brand, fontWeight: 700 }}
									>
										进入控制台
									</Button>
								)
								: (
									<Button
										size="large"
										onClick={() => navigate("/login?mode=register")}
										style={{ height: 54, paddingInline: 40, fontSize: 16, borderRadius: 12, background: "#fff", border: "none", color: C.brand, fontWeight: 700 }}
									>
										免费注册
										<ArrowRightOutlined />
									</Button>
								)}
						</div>
					</motion.div>
				</div>
			</section>

			{/* ---------- Footer ---------- */}
			<footer style={{ background: C.ink, color: "#fff" }}>
				<div className="mx-auto max-w-6xl px-6 py-14">
					<div className="grid gap-10 md:grid-cols-4">
						<div className="md:col-span-2">
							<div className="mb-4 flex items-center gap-2.5">
								<span
									className="flex items-center justify-center rounded-xl"
									style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${C.brand}, ${C.brandDark})`, color: "#fff" }}
								>
									<ExperimentOutlined style={{ fontSize: 17 }} />
								</span>
								<span style={{ fontSize: 18, fontWeight: 800 }}>LLM Factory</span>
							</div>
							<p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, maxWidth: 340, lineHeight: 1.7, margin: 0 }}>
								端到端大模型训练工厂 · 数据飞轮闭环 · 开源架构。
							</p>
							<div className="mt-5 flex gap-3" style={{ color: "rgba(255,255,255,0.5)" }}>
								<GithubOutlined className="text-xl" />
								<FileTextOutlined className="text-xl" />
								<ApiOutlined className="text-xl" />
								<LineChartOutlined className="text-xl" />
							</div>
						</div>
						<div>
							<h4 className="mb-3.5" style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>产品</h4>
							<ul className="flex flex-col gap-2.5" style={{ color: "rgba(255,255,255,0.55)", fontSize: 13.5, listStyle: "none", padding: 0, margin: 0 }}>
								<li className="flex items-center gap-2">
									<ControlOutlined className="text-xs" />
									数据飞轮
								</li>
								<li className="flex items-center gap-2">
									<ToolOutlined className="text-xs" />
									智能标注
								</li>
								<li className="flex items-center gap-2">
									<ExperimentOutlined className="text-xs" />
									LoRA 微调
								</li>
								<li className="flex items-center gap-2">
									<ThunderboltOutlined className="text-xs" />
									vLLM 推理
								</li>
							</ul>
						</div>
						<div>
							<h4 className="mb-3.5" style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>资源</h4>
							<ul className="flex flex-col gap-2.5" style={{ color: "rgba(255,255,255,0.55)", fontSize: 13.5, listStyle: "none", padding: 0, margin: 0 }}>
								<li className="flex items-center gap-2">
									<EyeOutlined className="text-xs" />
									架构文档
								</li>
								<li className="flex items-center gap-2">
									<ApiOutlined className="text-xs" />
									API 参考
								</li>
								<li className="flex items-center gap-2">
									<QuestionCircleOutlined className="text-xs" />
									常见问题
								</li>
								<li className="flex items-center gap-2">
									<CodeSandboxOutlined className="text-xs" />
									更新日志
								</li>
							</ul>
						</div>
					</div>
					<p className="mt-12 text-center" style={{ color: "rgba(255,255,255,0.35)", fontSize: 12.5 }}>
						© 2026 LLM Factory. Built with React + FastAPI + vLLM + LoRA.
					</p>
				</div>
			</footer>
		</div>
	);
}
