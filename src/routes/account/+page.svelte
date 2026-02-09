<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import * as Card from '$lib/components/ui/card';
    import * as Avatar from '$lib/components/ui/avatar';
    import { Separator } from '$lib/components/ui/separator';
    import { toast } from 'svelte-sonner';
    import { User, Building2, CreditCard, Save, ShieldCheck } from 'lucide-svelte';

    let { data, form } = $props();
    let profile = data.profile;
    let loading = $state(false);

    // 當 Action 結束後的處理
    function handleResult() {
        return async ({ result }) => {
            loading = false;
            if (result.type === 'success') {
                toast.success('個人資料已成功更新');
            } else if (result.type === 'failure') {
                toast.error(result.data?.message || '更新失敗，請稍後再試');
            }
        };
    }
</script>

<div class="container max-w-4xl py-10">
    <div class="mb-8 flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold tracking-tight">個人帳戶</h1>
            <p class="text-muted-foreground">管理您的個人資訊與匯款帳號設定</p>
        </div>
        <div class="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <ShieldCheck class="h-4 w-4" />
            資料傳輸已加密保護
        </div>
    </div>

    <div class="grid gap-8 md:grid-cols-[240px_1fr]">
        <!-- 側邊頭像與快速資訊 -->
        <div class="flex flex-col items-center gap-4">
            <Avatar.Root class="h-40 w-40 border-4 border-background shadow-xl">
                {#if profile?.avatar_url}
                    <Avatar.Image src={profile.avatar_url} alt={profile.full_name} />
                {/if}
                <Avatar.Fallback class="bg-primary/5 text-4xl text-primary">
                    {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                </Avatar.Fallback>
            </Avatar.Root>
            <div class="text-center">
                <h3 class="text-lg font-semibold">{profile?.full_name || '未設定姓名'}</h3>
                <p class="text-sm text-muted-foreground">{data.session?.user?.email}</p>
            </div>
            <Separator class="my-2" />
            <div class="w-full space-y-2">
                <div class="flex items-center justify-between text-sm">
                    <span class="text-muted-foreground">財務權限</span>
                    <span class={profile?.is_finance ? "text-primary" : "text-muted-foreground"}>
                        {profile?.is_finance ? "已啟動" : "未啟動"}
                    </span>
                </div>
                <div class="flex items-center justify-between text-sm">
                    <span class="text-muted-foreground">管理權限</span>
                    <span class={profile?.is_admin ? "text-primary" : "text-muted-foreground"}>
                        {profile?.is_admin ? "已啟動" : "未啟動"}
                    </span>
                </div>
            </div>
        </div>

        <!-- 主要編輯表單 -->
        <div class="space-y-6">
            <form method="POST" action="?/updateProfile" use:enhance={() => {
                loading = true;
                return handleResult();
            }}>
                <Card.Root>
                    <Card.Header>
                        <Card.Title class="flex items-center gap-2">
                            <User class="h-5 w-5 text-primary" />
                            基本資料
                        </Card.Title>
                        <Card.Description>更新您的顯示名稱與基本資訊</Card.Description>
                    </Card.Header>
                    <Card.Content class="space-y-4">
                        <div class="grid gap-2">
                            <Label for="fullName">姓名</Label>
                            <Input 
                                id="fullName" 
                                name="fullName" 
                                value={profile?.full_name || ''} 
                                placeholder="請輸入姓名" 
                                required 
                            />
                        </div>
                        <div class="grid gap-2 text-sm text-muted-foreground">
                            <span class="font-medium">電子郵件</span>
                            <div class="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 opacity-70">
                                {data.session?.user?.email}
                            </div>
                            <p class="text-[0.8rem]">電子郵件為唯讀項，如需修改請聯繫管理員。</p>
                        </div>
                    </Card.Content>
                </Card.Root>

                <div class="mt-6">
                    <Card.Root>
                        <Card.Header>
                            <Card.Title class="flex items-center gap-2">
                                <CreditCard class="h-5 w-5 text-primary" />
                                匯款帳號資訊
                            </Card.Title>
                            <Card.Description>此資訊僅用於報銷撥款，所有欄位均經強化的對稱加密儲存。</Card.Description>
                        </Card.Header>
                        <Card.Content class="space-y-4">
                            <div class="grid gap-2">
                                <Label for="bank">銀行</Label>
                                <div class="relative">
                                    <Building2 class="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        id="bank" 
                                        name="bank" 
                                        value={profile?.bank || ''} 
                                        class="pl-9" 
                                        placeholder="例如：004-臺灣銀行" 
                                    />
                                </div>
                            </div>
                            <div class="grid gap-2">
                                <Label for="bankAccount">銀行帳號</Label>
                                <Input 
                                    id="bankAccount" 
                                    name="bankAccount" 
                                    type="password"
                                    placeholder="••••••••••••" 
                                />
                                <p class="text-xs text-muted-foreground">
                                    為了安全，現有帳號將以星號顯示。如需更新請直接輸入新帳號，留空則保持不變。
                                </p>
                            </div>
                        </Card.Content>
                        <Card.Footer class="border-t bg-muted/50 px-6 py-4 flex justify-end">
                            <Button type="submit" disabled={loading} class="gap-2">
                                {#if loading}
                                    <span class="animate-spin h-4 w-4 border-2 border-background border-t-transparent rounded-full"></span>
                                {:else}
                                    <Save class="h-4 w-4" />
                                {/if}
                                儲存變更內容
                            </Button>
                        </Card.Footer>
                    </Card.Root>
                </div>
            </form>
        </div>
    </div>
</div>
