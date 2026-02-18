import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { uploadFileToStorage, validateFileUpload } from '$lib/server/storage-upload';
import {
    ALLOWED_ATTACHMENT_STATUSES,
    ALLOWED_UPLOAD_MIME_TYPES,
    EDITABLE_CLAIM_STATUSES
} from '$lib/server/claims/constants';

type ClaimItemInput = {
    date?: string;
    category?: string;
    description?: string;
    amount?: number | string;
    invoice_number?: string;
    attachment_status?: string;
    exempt_reason?: string;
    extra?: Record<string, unknown>;
};

function normalizeItems(itemsRaw: string): ClaimItemInput[] | null {
    try {
        const parsed = JSON.parse(itemsRaw);
        if (!Array.isArray(parsed)) return null;
        return parsed;
    } catch {
        return null;
    }
}

export const load: PageServerLoad = async ({ locals: { supabase, getSession } }) => {
    const session = await getSession();
    if (!session) {
        throw redirect(303, '/auth');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('approver_id, full_name, bank, bank_account_tail')
        .eq('id', session.user.id)
        .maybeSingle();

    const { data: payees, error } = await supabase
        .from('payees')
        .select('id, name, type, bank, bank_account_tail, editable_account')
        .eq('status', 'available')
        .order('name');

    if (error) {
        console.error('Error fetching payees:', error);
        return { payees: [] };
    }

    return {
        payees,
        hasApprover: Boolean(profile?.approver_id),
        applicantId: session.user.id,
        applicantName:
            profile?.full_name ||
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            session.user.email ||
            '',
        applicantBank: profile?.bank || '',
        applicantBankAccountTail: profile?.bank_account_tail || ''
    };
};

export const actions: Actions = {
    revealApplicantAccount: async ({ request, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: '未登入' });

        const formData = await request.formData();
        const targetId = String(formData.get('targetId') || '').trim() || session.user.id;

        const { data, error } = await supabase.rpc('reveal_profile_bank_account', {
            target_id: targetId
        });

        if (error) {
            console.error('Reveal Applicant Account Error:', error);
            return fail(500, { message: '解密失敗' });
        }

        return { success: true, decryptedAccount: data };
    },
    revealPayeeAccount: async ({ request, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: '未登入' });

        const formData = await request.formData();
        const payeeId = String(formData.get('payeeId') || '').trim();
        if (!payeeId) return fail(400, { message: 'Missing payeeId' });

        const { data, error } = await supabase.rpc('reveal_payee_bank_account', {
            _payee_id: payeeId
        });

        if (error) {
            console.error('Reveal Account Error:', error);
            return fail(500, { message: '解密失敗' });
        }

        return { success: true, decryptedAccount: data };
    },
    create: async ({ request, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const formData = await request.formData();
        const claimType = String(formData.get('claim_type') || '');
        const payeeId = String(formData.get('payee_id') || '');
        const itemsJson = String(formData.get('items') || '');
        const submitIntent = String(formData.get('submit_intent') || 'draft');
        const shouldSubmitDirectly = submitIntent === 'submit';

        const isFloatingAccount = formData.get('is_floating_account') === 'true';
        const bankCode = String(formData.get('bank_code') || '').trim();
        const bankAccount = String(formData.get('bank_account') || '').trim();
        const payFirstPatchDoc = formData.get('pay_first_patch_doc') === 'true';

        if (!claimType || !itemsJson) {
            return fail(400, { message: 'Missing required fields' });
        }
        if (!['draft', 'submit'].includes(submitIntent)) {
            return fail(400, { message: 'Invalid submit intent' });
        }

        const allowedTypes = new Set(['employee', 'vendor', 'personal_service']);
        if (!allowedTypes.has(claimType)) {
            return fail(400, { message: 'Invalid claim type' });
        }

        const items = normalizeItems(itemsJson);
        if ((!items || items.length === 0) && shouldSubmitDirectly) {
            return fail(400, { message: 'At least one item is required' });
        }
        const safeItems = items || [];

        const voucherSelections = safeItems.map((item) => {
            const statusRaw = String(item.attachment_status || '').trim();
            const exemptReason = String(item.exempt_reason || '').trim();
            const status = ALLOWED_ATTACHMENT_STATUSES.has(statusRaw)
                ? (statusRaw as 'uploaded' | 'pending_supplement' | 'exempt')
                : null;
            return { status, exemptReason };
        });

        const attachmentPlans: {
            effectiveStatus: 'uploaded' | 'pending_supplement' | 'exempt';
            exemptReason: string;
            file: File | null;
        }[] = [];
        for (let i = 0; i < safeItems.length; i += 1) {
            const selected = voucherSelections[i] || { status: null, exemptReason: '' };
            const file = formData.get(`item_attachment_${i}`) as File | null;
            const hasFile = Boolean(file && file.size > 0);

            if (shouldSubmitDirectly && !selected.status) {
                return fail(400, { message: `第 ${i + 1} 筆明細尚未選擇憑證處理方式` });
            }

            let effectiveStatus = selected.status || (hasFile ? 'uploaded' : 'pending_supplement');

            // Validation logic - only strict for direct submit
            if (shouldSubmitDirectly) {
                if (effectiveStatus === 'uploaded' && !hasFile) {
                    return fail(400, { message: `第 ${i + 1} 筆明細已選擇上傳憑證，請選擇附件檔案` });
                }
                if (effectiveStatus !== 'uploaded' && hasFile) {
                    return fail(400, { message: `第 ${i + 1} 筆明細已上傳檔案，請將憑證處理方式改為「上傳憑證」` });
                }
                if (effectiveStatus === 'exempt' && !selected.exemptReason) {
                    return fail(400, { message: `第 ${i + 1} 筆明細選擇「無憑證」時，必須填寫理由` });
                }
            } else {
                // Relaxed logic for drafts: if invalid state, fallback to pending_supplement
                if (effectiveStatus === 'uploaded' && !hasFile) {
                    effectiveStatus = 'pending_supplement';
                }
                if (effectiveStatus === 'exempt' && !selected.exemptReason) {
                    effectiveStatus = 'pending_supplement';
                }
            }

            attachmentPlans.push({ effectiveStatus, exemptReason: selected.exemptReason, file });
        }

        const claimItems = safeItems.map((item, index) => {
            const amount = Number(item.amount);
            return {
                claim_id: '',
                item_index: index + 1,
                date_start: item.date || new Date().toISOString().slice(0, 10),
                date_end: null,
                category: (item.category || 'general').trim(),
                description: String(item.description || '').trim(),
                amount: Number.isFinite(amount) ? amount : 0,
                invoice_number: item.invoice_number || null,
                attachment_status: (item.attachment_status as 'uploaded' | 'pending_supplement' | 'exempt') || 'pending_supplement',
                extra: {}
            };
        });

        if (shouldSubmitDirectly && claimItems.some((item) => item.amount <= 0)) {
            return fail(400, { message: 'All item amounts must be greater than 0' });
        }

        const totalAmount = claimItems.reduce((sum, item) => sum + item.amount, 0);

        let normalizedPayeeId: string | null = null;
        if (claimType !== 'employee') {
            if (!payeeId) {
                return fail(400, { message: 'Payee is required for this claim type' });
            }
            normalizedPayeeId = payeeId;
        }

        if (isFloatingAccount && claimType === 'employee') {
            return fail(400, { message: 'Employee claim cannot use floating account' });
        }

        if (isFloatingAccount && shouldSubmitDirectly && (!bankCode || !bankAccount)) {
            return fail(400, { message: 'Missing required bank information for floating account' });
        }

        const { data: claimId, error: claimError } = await supabase.rpc('create_claim', {
            _claim_type: claimType,
            _applicant_id: session.user.id,
            _payee_id: normalizedPayeeId,
            _total_amount: totalAmount,
            _bank_code: isFloatingAccount ? bankCode : null,
            _bank_account: isFloatingAccount ? bankAccount : null,
            _pay_first_patch_doc: payFirstPatchDoc
        });

        if (claimError || !claimId) {
            console.error('Error creating claim:', claimError);
            return fail(500, { message: 'Failed to create claim' });
        }

        const { data: createdItems, error: itemsError } = await supabase
            .from('claim_items')
            .insert(claimItems.map((item) => ({ ...item, claim_id: claimId })))
            .select('id, item_index');

        if (itemsError) {
            console.error('Error creating claim items:', itemsError);
            return fail(500, { message: 'Failed to create claim items' });
        }

        if (!createdItems) return fail(500, { message: 'Failed to read created claim items' });

        const itemIdByIndex = new Map<number, string>();
        for (const item of createdItems) {
            const itemIndex = Number((item as any).item_index);
            if (Number.isFinite(itemIndex)) {
                itemIdByIndex.set(itemIndex - 1, String((item as any).id));
            }
        }

        for (let i = 0; i < safeItems.length; i += 1) {
            const { effectiveStatus, exemptReason, file } = attachmentPlans[i];

            const itemId = itemIdByIndex.get(i);
            if (!itemId) {
                return fail(500, { message: `Failed to resolve claim item for attachment #${i + 1}` });
            }

            let nextExtra: Record<string, unknown> = {};
            if (effectiveStatus === 'uploaded' && file) {
                try {
                    validateFileUpload(file, `附件 #${i + 1}`, {
                        required: false,
                        maxBytes: 10 * 1024 * 1024,
                        allowedTypes: ALLOWED_UPLOAD_MIME_TYPES
                    });
                } catch (err: any) {
                    return fail(400, { message: err.message || 'Unsupported attachment type' });
                }

                let filePath = '';
                try {
                    filePath = await uploadFileToStorage(supabase, file, {
                        bucket: 'claims',
                        prefix: itemId,
                        folder: claimId
                    });
                } catch (err: any) {
                    console.error('Upload error while creating claim:', err);
                    return fail(500, { message: 'Failed to upload attachments' });
                }

                nextExtra = { file_path: filePath, original_name: file.name };
            } else if (effectiveStatus === 'exempt') {
                nextExtra = { exempt_reason: exemptReason };
            }

            const { error: attachmentUpdateError } = await supabase
                .from('claim_items')
                .update({
                    attachment_status: effectiveStatus,
                    extra: nextExtra
                })
                .eq('id', itemId)
                .eq('claim_id', claimId);

            if (attachmentUpdateError) {
                console.error('Error linking attachment while creating claim:', attachmentUpdateError);
                return fail(500, { message: 'Failed to link attachments to claim items' });
            }
        }

        if (shouldSubmitDirectly) {
            const { data: applicantProfile, error: profileError } = await supabase
                .from('profiles')
                .select('approver_id')
                .eq('id', session.user.id)
                .single();
            if (profileError) {
                return fail(500, { message: '讀取申請人資料失敗' });
            }
            if (!applicantProfile?.approver_id) {
                return fail(400, { message: '您尚未指派核准人，請聯繫管理員進行設定。' });
            }

            const nowIso = new Date().toISOString();
            const { data: updatedClaim, error: submitError } = await supabase
                .from('claims')
                .update({
                    status: 'pending_manager',
                    submitted_at: nowIso,
                    updated_at: nowIso
                })
                .eq('id', claimId)
                .eq('applicant_id', session.user.id)
                .in('status', Array.from(EDITABLE_CLAIM_STATUSES))
                .select('id, status')
                .maybeSingle();

            if (submitError) {
                return fail(500, { message: '提交失敗' });
            }
            if (!updatedClaim) {
                return fail(409, { message: '請款單狀態已變更，請重新整理後再試' });
            }
        }

        if (shouldSubmitDirectly) {
            throw redirect(303, '/claims?tab=processing');
        }

        throw redirect(303, '/claims?tab=draft');
    }
};
