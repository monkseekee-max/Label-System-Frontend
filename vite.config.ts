/// <reference types="vitest/config" />

import process from "node:process";
import { cleanupSVG, isEmptyColor, parseColors, runSVGO, SVG } from "@iconify/tools";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { codeInspectorPlugin } from "code-inspector-plugin";
import dayjs from "dayjs";
import { FileSystemIconLoader } from "unplugin-icons/loaders";
import Icons from "unplugin-icons/vite";
import { defineConfig } from "vite";
import { checker } from "vite-plugin-checker";
import { vitePluginFakeServer } from "vite-plugin-fake-server";
import svgrPlugin from "vite-plugin-svgr";

import { author, dependencies, devDependencies, license, name, version } from "./package.json";

const __APP_INFO__ = {
	pkg: { dependencies, devDependencies, name, version, license, author },
	lastBuildTime: dayjs(new Date()).format("YYYY-MM-DD HH:mm:ss"),
};

const isDev = process.env.NODE_ENV === "development";

// https://vitejs.dev/config/
export default defineConfig({

	base: isDev ? "/" : "/",
	plugins: [
		vitePluginFakeServer({
			basename: "/api",
			enableProd: false,
			timeout: 1000,
		}),
		// https://github.com/pd4d10/vite-plugin-svgr#options
		svgrPlugin({
			// https://react-svgr.com/docs/options/
			svgrOptions: {
				plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx"],
				svgoConfig: {
					floatPrecision: 2,
				},
			},
		}),
		checker({
			typescript: true,
			terminal: false,
			enableBuild: false,
		}),
		/**
		 * 点击页面 DOM 打开 IDE 并将光标自动定位到源代码位置
		 *
		 * macOS 默认组合键 Option + Shift
		 * Windows 默认组合键 Alt + Shift
		 * 在 Web 页面上按住组合键时，移动鼠标即会在 DOM 上出现遮罩层并显示相关信息，鼠标点击一下，将自动打开 IDE 并将光标定位到元素对应的代码位置
		 * 更多用法看 https://inspector.fe-dev.cn/guide/start.html
		 */
		codeInspectorPlugin({
			bundler: "vite",
			// hideConsole: true,
		}),

		/**
		 * 按需加载图标
		 * https://github.com/antfu/unplugin-icons
		 */
		Icons({
			customCollections: {
				svg: FileSystemIconLoader("./src/icons/svg"),
			},
			/**
			 * @see https://iconify.design/docs/articles/cleaning-up-icons/#parsing-one-monotone-icon
			 * Cleaning up icons
			 * Set default color to currentColor
			 * Set default width and height to 1em
			 */
			transform: (svg, collection) => {
				if (collection === "svg") {
					const svgObject = new SVG(svg);
					cleanupSVG(svgObject);
					runSVGO(svgObject);
					parseColors(svgObject, {
						defaultColor: "currentColor",
						callback: (attr, colorStr, color) => {
							if (!color) {
								// Color cannot be parsed!
								throw new Error(`Invalid color: "${colorStr}" in attribute ${attr}`);
							}

							if (isEmptyColor(color)) {
								// Color is empty: 'none' or 'transparent'. Return as is
								return color;
							}

							// If color is not empty, return it
							return color;
						},
					});
					return svgObject.toString({ height: "1em", width: "1em" }); ;
				}
				return svg;
			},
			compiler: "jsx",
			jsx: "react",
			scale: 1,
		}),

		tailwindcss(),
		react(),
	],
	test: {
		globals: true,
		environment: "happy-dom",
		setupFiles: ["./src/setupTests.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			thresholds: {
				lines: 60,
				branches: 50,
			},
		},
		// 排除 e2e 目录 (Playwright 测试用独立 runner, 不应被 vitest 收集)
		// 注意: build/** 只排除顶层构建产物, 不影响 src/build/ 测试目录
		exclude: ["**/node_modules/**", "**/dist/**", "build/**", "e2e/**"],
	},
	server: {
		port: 3335,
		strictPort: true,
		// Cloudflare Tunnel 对外域名; 不放行会被 Vite DNS-rebinding 保护拦截返回 403
		allowedHosts: ["fun-md.com", "app.fun-md.com"],
		// https://vitejs.dev/config/server-options#server-proxy
		proxy: {
			"/api": {
				// ADR-011: 开发期直连本地 FastAPI 后端 (端口 9090)
				// 前端 /api/auth/* 和 /api/v1/* 直接透传
				target: "http://127.0.0.1:9090",
				changeOrigin: true,
			},
		},
	},
	define: {
		__APP_INFO__: JSON.stringify(__APP_INFO__),
	},
	build: {
		// Generate license file after build
		license: true,
		outDir: "build",
		sourcemap: false,
		rollupOptions: {
			output: {
				// 细粒度分包 (A1 优化): 把巨型 antd chunk(1548KB) 拆成多个 vendor chunk
				// 分包策略: 按依赖层级分 (非按组件类型分), 保证依赖单向 → 无循环 chunk
				// 注: 本项目用 pnpm, 路径含 .pnpm/<pkg>@<ver>/node_modules/<pkg>/, 正则用 node_modules/<pkg>/ 匹配 (可跨嵌套层级)
				manualChunks(id) {
					// 仅处理 node_modules 中的第三方依赖 (业务代码走默认懒加载分包)
					if (!id.includes("node_modules")) {
						return undefined;
					}

					// react 核心 (react/react-dom/react-router 共享, 高频加载, 单独稳定 chunk)
					if (/\/node_modules\/(?:react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) {
						return "vendor-react";
					}

					// ===== antd 全生态合并 (消除内部固有循环依赖) =====
					// antd v6 内部: 组件层(antd/es) ↔ 底层(rc-*/@rc-component) ↔ icons 存在循环互引,
					// 拆分必产生 Circular chunk 警告 (运行时有风险), 故合并为单一稳定 vendor chunk.
					// 此 chunk 较大但: ①强缓存二次访问零成本 ②echarts/pro/motion 独立懒加载才是首屏收益
					if ([
						/\/node_modules\/antd\//,
						/\/node_modules\/@rc-component\//,
						/\/node_modules\/rc-[a-z]/,
						/\/node_modules\/@ant-design\/(?:cssinjs|colors|icons|icons-svg|react-slick)\//,
						/\/node_modules\/@babel\/runtime\//,
					].some(pattern => pattern.test(id))) {
						return "vendor-antd";
					}

					// antd pro-components (后台管理组件, 较重, 单独分包)
					if (/\/node_modules\/@ant-design\/pro-/.test(id)) {
						return "vendor-pro";
					}

					// echarts (仅 2 个页面用, 单独分包, 首屏不加载)
					if (/\/node_modules\/(?:echarts|echarts-for-react|zrender)\//.test(id)) {
						return "vendor-echarts";
					}

					// 动画库 (framer-motion/motion, 被 antd 部分组件依赖)
					if (/\/node_modules\/(?:motion-dom|motion-utils|framer-motion|popmotion)\//.test(id)) {
						return "vendor-motion";
					}

					// 数据层 (react-query/dayjs/ahooks 等状态/请求/工具库)
					if (/\/node_modules\/(?:@tanstack|dayjs|ahooks|zustand|react-i18next|i18next)\//.test(id)) {
						return "vendor-data";
					}

					// faker (仅 mock 用, 生产环境不应进首屏)
					if (/\/node_modules\/@faker-js\/faker/.test(id)) {
						return "vendor-faker";
					}

					// 其余第三方依赖: return undefined 让 rollup 默认分包 (跟随导入它的业务模块)
					// 避免强制归集单一 vendor-misc 导致跨 chunk 循环依赖
					return undefined;
				},
			},
		},
	},
});
