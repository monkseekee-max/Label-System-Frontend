import { Typography } from "antd";

import { C } from "./data";
import { Eyebrow } from "./eyebrow";

const { Title, Paragraph } = Typography;

export function SectionHeading({
	eyebrow,
	title,
	subtitle,
	dark,
}: {
	eyebrow: string
	title: string
	subtitle?: string
	dark?: boolean
}) {
	return (
		<div className="mb-14 text-center">
			<Eyebrow>{eyebrow}</Eyebrow>
			<Title
				level={2}
				style={{
					fontSize: "clamp(1.9rem, 3.6vw, 2.7rem)",
					fontWeight: 800,
					lineHeight: 1.2,
					margin: "0 0 14px",
					color: dark ? "#fff" : C.ink,
					letterSpacing: "-0.02em",
				}}
			>
				{title}
			</Title>
			{subtitle && (
				<Paragraph
					style={{
						fontSize: "clamp(1rem, 1.4vw, 1.1rem)",
						color: dark ? "rgba(255,255,255,0.7)" : C.muted,
						margin: 0,
						maxWidth: 620,
						marginInline: "auto",
						lineHeight: 1.7,
					}}
				>
					{subtitle}
				</Paragraph>
			)}
		</div>
	);
}
