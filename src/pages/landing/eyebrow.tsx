import type * as React from "react";
import { motion } from "motion/react";

import { C } from "./data";

/* ------------------------------------------------------------------ *
 * Eyebrow label — consistent section header treatment
 * ------------------------------------------------------------------ */
export function Eyebrow({ children }: { children: React.ReactNode }) {
	return (
		<motion.span
			className="mb-4 inline-flex items-center gap-2"
			style={{
				color: C.brand,
				fontWeight: 600,
				fontSize: 13,
				letterSpacing: "0.12em",
				textTransform: "uppercase",
				background: C.brandSoft,
				border: `1px solid ${C.brand}22`,
				borderRadius: 999,
				padding: "5px 14px",
			}}
		>
			<span
				style={{
					width: 6,
					height: 6,
					borderRadius: "50%",
					background: C.brand,
					display: "inline-block",
					boxShadow: `0 0 0 4px ${C.brand}22`,
				}}
			/>
			{children}
		</motion.span>
	);
}
