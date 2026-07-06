// gpu-monitor 派生数据 (从 index.tsx 提取, 纯函数可测, 不破坏 fast refresh)
// P2-12 模式: 与 dashboard-data.tsx 同构

export interface GPUMetric {
	id: string
	name: string
	utilization: number
	vramUsed: number
	vramTotal: number
	temperature: number
	power: number
	utilizationDisplay: string
	task: string
	status: "busy" | "active" | "idle"
	temperaturePercent: number
}

export interface AlertItem {
	id: string
	type: "warn" | "info" | "danger"
	message: string
}

// 告警阈值 (基于真实 GPU 指标动态派生告警, 而非硬编码)
export const TEMP_DANGER = 85; // °C, 超过为严重
export const TEMP_WARN = 75; // °C, 超过为警告
export const VRAM_WARN_RATIO = 0.9; // 显存使用率超过 90% 为警告
export const UTIL_BUSY = 50; // 利用率阈值 (与后端 status 判定一致)

/**
 * 从真实 GPU 指标派生告警 (取代硬编码 ALERTS_DATA).
 * 规则: 高温(danger/warn) / 显存接近上限(warn) / 空闲提示(info).
 */
export function deriveGpuAlerts(gpus: GPUMetric[]): AlertItem[] {
	const alerts: AlertItem[] = [];
	for (const gpu of gpus) {
		if (gpu.temperature >= TEMP_DANGER) {
			alerts.push({
				id: `${gpu.id}-temp-danger`,
				type: "danger",
				message: `${gpu.name} 温度 ${gpu.temperature}°C 超过 ${TEMP_DANGER}°C，请检查散热或降低负载`,
			});
		}
		else if (gpu.temperature >= TEMP_WARN) {
			alerts.push({
				id: `${gpu.id}-temp-warn`,
				type: "warn",
				message: `${gpu.name} 温度 ${gpu.temperature}°C 偏高，建议关注`,
			});
		}
		if (gpu.vramTotal > 0 && gpu.vramUsed / gpu.vramTotal >= VRAM_WARN_RATIO) {
			const pct = Math.round((gpu.vramUsed / gpu.vramTotal) * 100);
			alerts.push({
				id: `${gpu.id}-vram`,
				type: "warn",
				message: `${gpu.name} 显存使用 ${pct}% (${gpu.vramUsed}/${gpu.vramTotal} GB)，接近上限，注意 OOM 风险`,
			});
		}
		if (gpu.utilization < UTIL_BUSY && gpu.status === "idle") {
			alerts.push({
				id: `${gpu.id}-idle`,
				type: "info",
				message: `${gpu.name} 当前空闲，可用于新训练任务分配`,
			});
		}
	}
	return alerts;
}
