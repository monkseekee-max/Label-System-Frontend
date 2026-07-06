import { motion } from "motion/react";

import { C, TERMINAL_LINES } from "./data";

/* ------------------------------------------------------------------ *
 * Terminal mockup — appears once, in the hero
 * ------------------------------------------------------------------ */
export function TerminalMockup() {
	return (
		<div
			className="overflow-hidden rounded-2xl"
			style={{
				background: "#0B1220",
				border: "1px solid #1E2A44",
				boxShadow: "0 30px 60px -20px rgba(11,18,32,0.45), 0 8px 24px rgba(22,93,255,0.12)",
			}}
		>
			<div
				className="flex items-center gap-2 px-4 py-3"
				style={{ background: "#111A2E", borderBottom: "1px solid #1E2A44" }}
			>
				<span style={{ width: 12, height: 12, borderRadius: "50%", background: "#FF5F56", display: "inline-block" }} />
				<span style={{ width: 12, height: 12, borderRadius: "50%", background: "#FFBD2E", display: "inline-block" }} />
				<span style={{ width: 12, height: 12, borderRadius: "50%", background: "#27C93F", display: "inline-block" }} />
				<span className="ml-3" style={{ color: C.mutedSoft, fontFamily: "monospace", fontSize: 12 }}>
					llm-factory — zsh
				</span>
			</div>
			<div className="p-5" style={{ minHeight: 264, fontFamily: "monospace", fontSize: 13 }}>
				{TERMINAL_LINES.map((line, i) => (
					<motion.div
						key={`${line.p}-${line.t}`}
						className="flex gap-3 leading-8"
						initial={{ opacity: 0, x: -8 }}
						whileInView={{ opacity: 1, x: 0 }}
						viewport={{ once: true }}
						transition={{ delay: i * 0.1, duration: 0.3 }}
					>
						<span style={{ color: line.c, flexShrink: 0, width: 16 }}>{line.p}</span>
						<span style={{ color: line.p === "$" ? "#D7DEEA" : line.c }}>{line.t}</span>
					</motion.div>
				))}
				<motion.span
					className="inline-block"
					style={{ color: C.brand, fontWeight: 700, marginLeft: 16 }}
					animate={{ opacity: [1, 0] }}
					transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1 }}
				>
					▋
				</motion.span>
			</div>
		</div>
	);
}
