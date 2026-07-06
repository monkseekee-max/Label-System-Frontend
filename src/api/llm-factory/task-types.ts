import type { TaskType } from "./types";
import { factoryApi } from "./factory-client";
import { delay, toApiResponse, withFallback } from "./shared";

const MOCK_TASK_TYPES: TaskType[] = [
	{
		id: "task-type-1",
		code: "TEXT_QA",
		name: "text_qa",
		subtitle: "文本问答",
		modality: "text",
		recommendedModel: "qwen3-8b",
		trainingTrack: "unsloth_sft",
		labelTemplate: "TextQALabelTemplate",
		inferencePort: 8001,
		dataFormat: "ShareGPT (3种)",
	},
	{
		id: "task-type-2",
		code: "IMAGE_CAPTION",
		name: "image_caption",
		subtitle: "图像描述",
		modality: "image",
		recommendedModel: "qwen3.5-4b",
		trainingTrack: "hf_peft_lora",
		labelTemplate: "ImageCaptionLabelTemplate",
		inferencePort: 8002,
		dataFormat: "多模态 messages",
	},
	{
		id: "task-type-3",
		code: "IMAGE_QA",
		name: "image_qa",
		subtitle: "图像问答",
		modality: "image",
		recommendedModel: "qwen3.5-4b",
		trainingTrack: "hf_peft_lora",
		labelTemplate: "ImageQALabelTemplate",
		inferencePort: 8002,
		dataFormat: "多模态 messages",
	},
	{
		id: "task-type-4",
		code: "VIDEO_QA",
		name: "video_qa",
		subtitle: "视频问答",
		modality: "video",
		recommendedModel: "qwen3.5-4b",
		trainingTrack: "hf_peft_lora",
		labelTemplate: "VideoQALabelTemplate",
		inferencePort: 8002,
		dataFormat: "多模态 messages",
	},
	{
		id: "task-type-5",
		code: "VIDEO_CAPTION",
		name: "video_caption",
		subtitle: "视频描述",
		modality: "video",
		recommendedModel: "qwen3.5-4b",
		trainingTrack: "hf_peft_lora",
		labelTemplate: "VideoCaptionLabelTemplate",
		inferencePort: 8002,
		dataFormat: "多模态 messages",
	},
	{
		id: "task-type-6",
		code: "TEXT_ONLY",
		name: "text_only",
		subtitle: "纯文本",
		modality: "text",
		recommendedModel: "qwen3-8b",
		trainingTrack: "unsloth_sft",
		labelTemplate: "—",
		inferencePort: 8001,
		dataFormat: "ShareGPT",
	},
];

// Task Types
export function fetchTaskTypeList() {
	return withFallback(async () => {
		const res = await factoryApi.getTaskTypes();
		return res.taskTypes.map((t, idx): TaskType => ({
			id: `tt_${idx}`,
			code: "TEXT_QA" as TaskType["code"],
			name: t.trainingTrack,
			subtitle: t.dataFormat,
			modality: t.inferencePort === 8002 ? "image" : "text",
			recommendedModel: t.recommendedModel,
			trainingTrack: t.trainingTrack,
			labelTemplate: t.annotationTemplate,
			inferencePort: t.inferencePort,
			dataFormat: t.dataFormat,
		}));
	}, () => delay(150).then(() => toApiResponse({ code: 200, message: "success", data: MOCK_TASK_TYPES })));
}
