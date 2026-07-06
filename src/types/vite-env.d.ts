/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

// https://vitejs.dev/guide/env-and-mode.html#intellisense-for-typescript
interface ImportMetaEnv {
	readonly VITE_API_BASE_URL: string
	readonly VITE_BASE_HOME_PATH: string
	readonly VITE_GLOB_APP_TITLE: string
	readonly VITE_ROUTER_MODE: string
	// 请求超时 (毫秒), 缺省 60000
	readonly VITE_API_TIMEOUT: string
	// Zustand 存储命名前缀, 解决多项目共存命名冲突
	readonly VITE_APP_NAMESPACE: string
	// Mock fallback 开关: 开发/演示 true, 生产必须 false
	readonly VITE_ENABLE_MOCK_FALLBACK: string
	// llm-factory 直连 Base URL, 默认空 → 同源 /api 代理
	readonly VITE_LLM_FACTORY_BASE_URL: string
	// admin 跨租户场景的默认 companyId (普通用户由后端从 token 取)
	readonly VITE_COMPANY_ID: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
