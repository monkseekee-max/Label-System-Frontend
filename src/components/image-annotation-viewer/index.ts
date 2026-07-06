/**
 * Image Annotation Viewer 图片标注查看器
 *
 * 提供一个可交互的图片标注组件，支持：
 * - 在图片上绘制、移动、调整大小矩形框
 * - 标签管理和颜色自动分配
 * - 键盘快捷键（Delete/Backspace 删除）
 * - 与父组件的双向数据同步
 *
 * 导出内容：
 * - ImageAnnotationViewer: 主组件
 * - AnnotationData / AnnotationShape: 标注数据结构
 * - ImageAnnotationViewerProps: 组件属性类型
 */
export { ImageAnnotationViewer } from "./image-annotation-viewer";
export type { AnnotationData, AnnotationShape, ImageAnnotationViewerProps } from "./types";
