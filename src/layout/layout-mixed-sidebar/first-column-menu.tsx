import type { MenuProps } from "antd";
import type { MenuItemType } from "../layout-menu/types";

import { Scrollbar } from "#src/components/scrollbar";
import { usePreferences } from "#src/hooks/use-preferences";
import { ConfigProvider, Menu, theme } from "antd";

import { clsx } from "clsx";

import { headerHeight } from "../constants";
import { Logo } from "../widgets/logo";
import "./first-column-menu.css";

interface FirstColumnMenuProps {
	menus?: MenuItemType[]
	sideNavMenuKeyInSplitMode?: string
	handleMenuSelect?: (key: string, mode: MenuProps["mode"]) => void
}

const emptyArray: MenuItemType[] = [];
export default function FirstColumnMenu({
	handleMenuSelect,
	menus = emptyArray,
	sideNavMenuKeyInSplitMode,
}: FirstColumnMenuProps) {
	const { token } = theme.useToken();
	const { firstColumnWidthInTwoColumnNavigation, isDark, sidebarTheme } = usePreferences();

	return (

		<div
			style={{
				width: firstColumnWidthInTwoColumnNavigation,
			}}
			className={clsx("border-r h-full", sidebarTheme === "dark" ? "border-r-[#303030]" : "border-r-colorBorderSecondary")}
		>
			<Logo sidebarCollapsed />
			<Scrollbar style={{ height: `calc(100% - ${headerHeight}px)` }}>
				<ConfigProvider theme={{
					components: {
						Menu: {
							collapsedWidth: firstColumnWidthInTwoColumnNavigation - 1,
						},
					},
				}}
				>
					<Menu
						mode="vertical"
						// inlineCollapsed
						selectedKeys={[sideNavMenuKeyInSplitMode ?? ""]}
					className={clsx("first-column-menu")}
					style={{ "--first-col-gap": token.sizeXS, "--first-col-icon-size": token.fontSizeIcon } as React.CSSProperties}
					items={menus as MenuProps["items"]}
						theme={isDark ? "dark" : sidebarTheme}
						/**
						 * 使用 onClick 替代 onSelect 事件，原因是当子路由激活父菜单时，点击父菜单依然可以正常导航。
						 * @see https://github.com/user-attachments/assets/cf67a973-f210-45e4-8278-08727ab1b8ce
						 */
						onClick={({ key }) => handleMenuSelect?.(key, "horizontal")}
					/>
				</ConfigProvider>
			</Scrollbar>
		</div>
	);
}
