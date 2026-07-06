import type { ComponentType } from "react";

import {
	AntDesignOutlined,
	ApartmentOutlined,
	ApiOutlined,
	BankOutlined,
	BookOutlined,
	CloudOutlined,
	ContainerOutlined,
	CopyrightOutlined,
	DashboardOutlined,
	ExperimentOutlined,
	EyeOutlined,
	FileTextOutlined,
	HistoryOutlined,
	HomeOutlined,
	LockOutlined,
	MenuOutlined,
	NodeExpandOutlined,
	PlusOutlined,
	SafetyOutlined,
	SettingOutlined,
	SisternodeOutlined,
	SubnodeOutlined,
	TeamOutlined,
	UserOutlined,
	UserSwitchOutlined,
} from "@ant-design/icons";
import { EmbeddedIcon, ExternalIcon, OutsidePageIcon, ProfileCardIcon } from "./local-icons";
import { RiAccountCircleLine, RiReactjsLine, RiUserSettingsLine } from "./ri";

/**
 * The shared renderable shape of every menu icon entry, regardless of source
 * (Ant Design icons, local SVGs, or Remix icons). Each is a React component
 * that can be passed to `createElement`.
 *
 * Props are intentionally `any` here because the three icon sources have
 * incompatible prop types (AntD `IconComponentProps` vs raw `SVGProps`), but
 * they are always rendered without props by the menu generator. The KEY
 * type-safety (no `any` in the record's value slot being a non-component) is
 * the protection this type provides.
 */
export type MenuIconComponent = ComponentType<any>;

/**
 * Registry of icons addressable by name from route metadata (`handle.icon`).
 *
 * Keys are looked up by dynamic string in `generate-menu-items-from-routes`,
 * so the record keeps a `string` index signature; values are strongly typed
 * as React components (previously `Record<string, any>` — audit finding C4).
 */
export const menuIcons: Record<string, MenuIconComponent> = {
	EmbeddedIcon,
	HomeOutlined,
	SafetyOutlined,
	CloudOutlined,
	FileTextOutlined,
	LockOutlined,
	EyeOutlined,
	NodeExpandOutlined,
	SisternodeOutlined,
	SubnodeOutlined,
	OutsidePageIcon,
	AntDesignOutlined,
	ContainerOutlined,
	ExternalIcon,
	RiReactjsLine,
	SettingOutlined,
	UserOutlined,
	TeamOutlined,
	MenuOutlined,
	ApartmentOutlined,
	ApiOutlined,
	RiAccountCircleLine,
	ProfileCardIcon,
	RiUserSettingsLine,
	CopyrightOutlined,
	BankOutlined,
	UserSwitchOutlined,
	PlusOutlined,
	HistoryOutlined,
	ExperimentOutlined,
	DashboardOutlined,
	BookOutlined,
};
