import type { AnnotationData } from "#src/components/image-annotation-viewer";

import { BasicContent } from "#src/components/basic-content";
import { ImageAnnotationViewer } from "#src/components/image-annotation-viewer";
import { Card, Typography } from "antd";
import { useState } from "react";

/** Sample annotation data matching the user's JSON format */
const SAMPLE_DATA: AnnotationData = {
	version: "4.0.0-beta.5",
	flags: {},
	shapes: [
		{
			label: "person",
			score: 0.9079572558403015,
			points: [[369.5, 84.4], [500.0, 332.7]],
			shape_type: "rectangle",
			group_id: null,
			description: null,
			difficult: false,
			flags: null,
			attributes: {},
			kie_linking: [],
		},
		{
			label: "person",
			score: 0.8639726042747498,
			points: [[188.8, 117.3], [314.0, 328.9]],
			shape_type: "rectangle",
			group_id: null,
			description: null,
			difficult: false,
			flags: null,
			attributes: {},
			kie_linking: [],
		},
		{
			label: "bottle",
			score: 0.7847520709037781,
			points: [[367.9, 158.3], [387.9, 213.1]],
			shape_type: "rectangle",
			group_id: null,
			description: null,
			difficult: false,
			flags: null,
			attributes: {},
			kie_linking: [],
		},
		{
			label: "bowl",
			score: 0.6960831880569458,
			points: [[316.7, 298.0], [363.2, 329.5]],
			shape_type: "rectangle",
			group_id: null,
			description: null,
			difficult: false,
			flags: null,
			attributes: {},
			kie_linking: [],
		},
		{
			label: "dining table",
			score: 0.49635207653045654,
			points: [[269.8, 265.5], [433.1, 336.4]],
			shape_type: "rectangle",
			group_id: null,
			description: null,
			difficult: false,
			flags: null,
			attributes: {},
			kie_linking: [],
		},
		{
			label: "bowl",
			score: 0.4621894955635071,
			points: [[351.9, 292.5], [392.5, 315.0]],
			shape_type: "rectangle",
			group_id: null,
			description: null,
			difficult: false,
			flags: null,
			attributes: {},
			kie_linking: [],
		},
		{
			label: "bowl",
			score: 0.4277836084365845,
			points: [[353.0, 292.1], [392.2, 330.6]],
			shape_type: "rectangle",
			group_id: null,
			description: null,
			difficult: false,
			flags: null,
			attributes: {},
			kie_linking: [],
		},
		{
			label: "bowl",
			score: 0.4165849983692169,
			points: [[307.1, 281.0], [347.2, 305.5]],
			shape_type: "rectangle",
			group_id: null,
			description: null,
			difficult: false,
			flags: null,
			attributes: {},
			kie_linking: [],
		},
		{
			label: "bowl",
			score: 0.38125163316726685,
			points: [[360.8, 310.3], [391.7, 336.2]],
			shape_type: "rectangle",
			group_id: null,
			description: null,
			difficult: false,
			flags: null,
			attributes: {},
			kie_linking: [],
		},
		{
			label: "potted plant",
			score: 0.35031089186668396,
			points: [[417.3, 77.2], [451.0, 123.9]],
			shape_type: "rectangle",
			group_id: null,
			description: null,
			difficult: false,
			flags: null,
			attributes: {},
			kie_linking: [],
		},
		{
			label: "bowl",
			score: 0.31785669922828674,
			points: [[348.9, 273.3], [374.2, 294.2]],
			shape_type: "rectangle",
			group_id: null,
			description: null,
			difficult: false,
			flags: null,
			attributes: {},
			kie_linking: [],
		},
		{
			label: "chair",
			score: 0.28863874077796936,
			points: [[441.8, 253.1], [476.4, 283.7]],
			shape_type: "rectangle",
			group_id: null,
			description: null,
			difficult: false,
			flags: null,
			attributes: {},
			kie_linking: [],
		},
	],
	imagePath: "img.png",
	imageData: null,
	imageHeight: 338,
	imageWidth: 500,
};

export default function ImageAnnotationDemo() {
	const [outputJson, setOutputJson] = useState<AnnotationData | null>(null);

	return (
		<BasicContent className="h-full flex flex-col" style={{ minHeight: 0 }}>
			<Typography.Title level={4} style={{ margin: 0, flexShrink: 0 }}>
				Image Annotation Viewer Demo
			</Typography.Title>

			<div
				style={{
					flex: 1,
					minHeight: 0,
					display: "grid",
					gridTemplateColumns: "1fr 400px",
					gap: 16,
					paddingTop: 12,
				}}
			>
				<Card
					title="图片标注"
					style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}
					styles={{ body: { padding: 0, flex: 1, minHeight: 0, overflow: "hidden" } }}
				>
					<ImageAnnotationViewer
						imageUrl="https://picsum.photos/seed/dining/500/338"
						imageWidth={500}
						imageHeight={338}
						annotations={SAMPLE_DATA}
						onChange={setOutputJson}
					/>
				</Card>

				<Card
					title="Output JSON"
					style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}
					styles={{ body: { padding: 0, flex: 1, minHeight: 0, overflow: "auto" } }}
				>
					<pre style={{ padding: 12, margin: 0, fontSize: 12, lineHeight: 1.5 }}>
						{outputJson ? JSON.stringify(outputJson, null, 2) : "编辑标注框后将在此显示输出 JSON"}
					</pre>
				</Card>
			</div>
		</BasicContent>
	);
}
