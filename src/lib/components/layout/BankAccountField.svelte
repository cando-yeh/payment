<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Eye, EyeOff } from "lucide-svelte";

  let {
    id = "bankAccount",
    name,
    value = $bindable(""),
    readonlyValue = "",
    isEditable = false,
    showAccountValue = false,
    revealing = false,
    disabled = false,
    placeholder = "••••••••••••",
    revealEnabled = true,
    onToggleReveal,
  }: {
    id?: string;
    name?: string;
    value?: string;
    readonlyValue?: string;
    isEditable?: boolean;
    showAccountValue?: boolean;
    revealing?: boolean;
    disabled?: boolean;
    placeholder?: string;
    revealEnabled?: boolean;
    onToggleReveal: () => void;
  } = $props();
</script>

<div class="relative">
  {#if isEditable}
    <Input
      {id}
      {name}
      type={showAccountValue ? "text" : "password"}
      bind:value
      {placeholder}
      disabled={disabled || revealing}
    />
  {:else}
    <Input
      type="text"
      value={readonlyValue}
      readonly
      disabled
      class="pointer-events-none pr-10"
    />
  {/if}

  <Button
    type="button"
    variant="ghost"
    size="icon"
    class="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
    onclick={onToggleReveal}
    disabled={revealing || !revealEnabled}
  >
    {#if revealing}
      <span class="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></span>
    {:else if showAccountValue}
      <Eye class="h-4 w-4 text-muted-foreground" />
    {:else}
      <EyeOff class="h-4 w-4 text-muted-foreground" />
    {/if}
  </Button>
</div>
