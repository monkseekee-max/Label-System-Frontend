import { SyncOutlined } from "@ant-design/icons";
import { motion } from "motion/react";

import { C, FLYWHEEL_STEPS } from "./data";

/* ------------------------------------------------------------------ *
 * Data flywheel — signature circular visual
 * ------------------------------------------------------------------ */
export function Flywheel() {
	const R = 180; // ring radius (px) on desktop
	const size = R * 2 + 96;
	const center = size / 2;

	// 6 nodes evenly around the circle, starting at top (-90deg)
	const nodes = FLYWHEEL_STEPS.map((step, i) => {
		const angle = (-90 + i * 60) * (Math.PI / 180);
		return {
			...step,
			x: center + R * Math.cos(angle),
			y: center + R * Math.sin(angle),
			i,
		};
	});

	return (
		<div className="flex justify-center">
			{/* Desktop / tablet: circular diagram */}
			<div
				className="relative hidden sm:block"
				style={{ width: size, height: size }}
			>
				{/* rotating dashed ring */}
				<svg
					className="absolute inset-0"
					width={size}
					height={size}
					viewBox={`0 0 ${size} ${size}`}
					fill="none"
					aria-hidden
				>
					<defs>
						<linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
							<stop offset="0%" stopColor={C.brand} stopOpacity="0.9" />
							<stop offset="100%" stopColor={C.accent} stopOpacity="0.6" />
						</linearGradient>
						<radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
							<stop offset="0%" stopColor={C.brand} stopOpacity="0.22" />
							<stop offset="70%" stopColor={C.brand} stopOpacity="0.04" />
							<stop offset="100%" stopColor={C.brand} stopOpacity="0" />
						</radialGradient>
					</defs>
					<circle cx={center} cy={center} r={R} fill="url(#coreGlow)" />
					<circle
						cx={center}
						cy={center}
						r={R}
						stroke={C.line}
						strokeWidth="2"
						strokeDasharray="2 8"
						style={{ transformOrigin: "center", animation: "spin-slow 28s linear infinite" }}
					/>
					<circle
						cx={center}
						cy={center}
						r={R}
						stroke="url(#ringGrad)"
						strokeWidth="2.5"
						strokeDasharray="14 26"
						strokeLinecap="round"
						style={{ transformOrigin: "center", animation: "spin-slow 14s linear infinite" }}
					/>
					{/* directional arrows along the ring */}
					{[0, 2, 4].map((idx) => {
						const a = (-90 + idx * 60 + 30) * (Math.PI / 180);
						const ax = center + R * Math.cos(a);
						const ay = center + R * Math.sin(a);
						return (
							<g key={idx} transform={`translate(${ax} ${ay}) rotate(${(-90 + idx * 60 + 30) + 90})`}>
								<path d="M-6 -5 L0 0 L-6 5" stroke={C.brand} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.55" />
							</g>
						);
					})}
				</svg>

				{/* center core */}
				<motion.div
					className="absolute flex flex-col items-center justify-center rounded-full text-center"
					style={{
						width: 116,
						height: 116,
						left: center - 58,
						top: center - 58,
						background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)`,
						color: "#fff",
						boxShadow: `0 16px 40px ${C.brand}55`,
					}}
					animate={{ scale: [1, 1.04, 1] }}
					transition={{ repeat: Number.POSITIVE_INFINITY, duration: 3.5, ease: "easeInOut" }}
				>
					<SyncOutlined style={{ fontSize: 22 }} />
					<span className="mt-1" style={{ fontWeight: 700, fontSize: 15 }}>数据飞轮</span>
					<span style={{ fontSize: 11, opacity: 0.8 }}>self-improving</span>
				</motion.div>

				{/* nodes */}
				{nodes.map(node => (
					<motion.div
						key={node.label}
						className="absolute flex w-28 flex-col items-center gap-1.5"
						style={{ left: node.x - 56, top: node.y - 46 }}
						initial={{ opacity: 0, scale: 0.6 }}
						whileInView={{ opacity: 1, scale: 1 }}
						viewport={{ once: true }}
						transition={{ delay: node.i * 0.08, duration: 0.4, ease: "backOut" }}
						whileHover={{ scale: 1.08 }}
					>
						<div
							className="flex items-center justify-center rounded-2xl"
							style={{
								width: 56,
								height: 56,
								background: "#fff",
								border: `1px solid ${C.line}`,
								color: C.brand,
								boxShadow: "0 8px 20px rgba(22,93,255,0.12)",
							}}
						>
							{node.icon}
						</div>
						<span style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>{node.label}</span>
						<span style={{ fontSize: 11, color: C.mutedSoft }}>{node.desc}</span>
					</motion.div>
				))}
			</div>

			{/* Mobile: clean vertical flow */}
			<div className="grid w-full max-w-md grid-cols-2 gap-3 sm:hidden">
				{FLYWHEEL_STEPS.map((step, i) => (
					<motion.div
						key={step.label}
						className="flex items-center gap-3 rounded-2xl p-4"
						style={{ background: "#fff", border: `1px solid ${C.line}` }}
						initial={{ opacity: 0, y: 12 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ delay: i * 0.05 }}
					>
						<div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: C.brandSoft, color: C.brand }}>
							{step.icon}
						</div>
						<div>
							<div style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>{step.label}</div>
							<div style={{ fontSize: 11, color: C.mutedSoft }}>{step.desc}</div>
						</div>
					</motion.div>
				))}
			</div>
		</div>
	);
}
