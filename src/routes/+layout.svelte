<script lang="ts">
	/**
	 * 全域共用版面 (Root Layout)
	 * 職責：定義所有頁面的共用結構（如 CSS、導覽列、Session 監聽）。
	 */
	import "../app.css";
	import { invalidate } from "$app/navigation";
	import { onMount } from "svelte";

	let { data, children } = $props();

	onMount(() => {
		const {
			data: { subscription },
		} = data.session
			? { data: { subscription: { unsubscribe: () => {} } } }
			: { data: { subscription: { unsubscribe: () => {} } } };

		// 這裡之後會加入 auth 狀態變更的監聽
		// 目前先保持基本結構
		return () => subscription.unsubscribe();
	});
</script>

{@render children()}
