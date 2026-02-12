<script lang="ts">
    import { Input } from "$lib/components/ui/input";
    import {
        BANK_LIST,
        formatBankCodeName,
        getBankDisplayLabel,
        parseBankCode,
    } from "$lib/constants/banks";

    type SubmitMode = "code" | "code-name";

    let {
        id = "bank_code",
        name = "bank_code",
        value = $bindable(""),
        required = false,
        disabled = false,
        submitMode = "code" as SubmitMode,
        placeholder = "搜尋銀行代碼或名稱",
        class: className = "",
        inputClass = "",
    } = $props();

    const datalistId = $derived(`${id}-options`);
    let displayValue = $state("");

    function toSubmitValue(code: string): string {
        return submitMode === "code-name" ? formatBankCodeName(code) : code;
    }

    function syncDisplayFromBoundValue() {
        const currentCode = parseBankCode(value);
        if (!currentCode) {
            displayValue = "";
            return;
        }
        value = toSubmitValue(currentCode);
        displayValue = getBankDisplayLabel(currentCode);
    }

    $effect(() => {
        syncDisplayFromBoundValue();
    });

    function handleInput(rawValue: string) {
        displayValue = rawValue;
        const code = parseBankCode(rawValue);
        value = code ? toSubmitValue(code) : "";
    }
</script>

<div class={className}>
    <Input
        id={id}
        type="text"
        list={datalistId}
        value={displayValue}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        pattern="\d{3}.*"
        title="請選擇銀行代碼（3 碼）"
        oninput={(e) => handleInput((e.currentTarget as HTMLInputElement).value)}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded="false"
        class={inputClass}
    />
    <input type="hidden" name={name} value={value} />
    <datalist id={datalistId}>
        {#each BANK_LIST as bank}
            <option value={`${bank.code} ${bank.name}`}></option>
        {/each}
    </datalist>
</div>
