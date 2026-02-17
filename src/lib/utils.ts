/**
 * 通用工具函數庫
 * 
 * 包含：
 * 1. Tailwind CSS 類別合併工具。
 * 2. TypeScript 輔助型別。
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn (Class Name) 輔助函數
 * 
 * 職責：
 * 整合 clsx 與 tailwind-merge。
 * 1. clsx: 處理條件標籤 (例如：`isActive && 'bg-blue-500'`)。
 * 2. tailwind-merge: 解決 Tailwind 類別衝突 (例如：'p-4 p-2' 會合併為 'p-2')。
 * 
 * @param inputs - 各種格式的類別名稱（字串、物件、陣列）
 * @returns 合併後的乾淨類別字串
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
	return new Intl.NumberFormat("zh-TW", {
		style: "currency",
		currency: "TWD",
		maximumFractionDigits: 0,
	}).format(amount).replace("TWD", "").trim();
}

export function formatDate(date: string | Date | undefined | null) {
	if (!date) return "-";
	return new Date(date).toLocaleDateString("zh-TW");
}

// ========================================
// TypeScript 輔助型別
// ========================================

/** 移除屬性中的 child 欄位 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;

/** 移除屬性中的 children 欄位 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;

/** 同時移除 child 與 children 欄位 */
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;

/** 為組件 Props 注入 ref 屬性 (用於 DOM 元素引用) */
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
