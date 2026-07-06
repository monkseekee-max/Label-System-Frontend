// 定义 HTTP 请求头中用于传递授权信息的字段名
export const AUTH_HEADER = "Authorization";

// 定义 HTTP 请求头中用于指定语言偏好的字段名
export const LANG_HEADER = "X-Lang";

// 定义 HTTP 请求头中用于指定应用名称的字段名
export const APP_NAME_HEADER = "X-App-Name";

// AUTH-D1 (ADR-021): 刷新访问令牌的路径, 对齐后端 /api/auth/refresh
export const REFRESH_TOKEN_PATH = "auth/refresh";
