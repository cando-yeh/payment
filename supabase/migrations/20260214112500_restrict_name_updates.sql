-- 禁止管理員修改他人的 full_name，姓名僅能由本人修改。
-- 此遷移新增一個 RLS 政策來強化 profiles 表的安全性。

-- 1. 先刪除可能存在的衝突政策
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- 2. 重新定義管理員更新政策，排除對 full_name 的修改（除非是修改自己）
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    -- 只有管理員可以執行此政策
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
)
WITH CHECK (
    -- 如果不是本人，則 full_name 必須維持原樣
    (id = auth.uid()) OR (
        full_name = (SELECT full_name FROM public.profiles WHERE id = profiles.id)
    )
);

-- 3. 確保使用者仍可修改自己的所有欄位
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
