const EVENT_LABELS = {
    submit: "送出審核",
    withdraw: "撤回草稿",
    approve_manager: "主管核准",
    reject_manager: "主管駁回",
    approve_finance: "財務核准",
    reject_finance: "財務駁回",
    reject_payment: "退回財審",
    pay_completed: "完成撥款",
    pay_completed_need_doc: "完成撥款（需補件）",
    supplement_submitted: "補件送審",
    supplement_approved: "補件核准",
    supplement_rejected: "補件駁回",
    cancelled: "撤銷申請",
    payment_reversed: "撤銷撥款"
};

const CLAIM_TYPE_LABELS = {
    employee: "員工報銷",
    vendor: "廠商請款",
    personal_service: "個人勞務"
};

const STATUS_LABELS = {
    draft: "草稿",
    pending_manager: "待主管審核",
    pending_finance: "待財務審核",
    pending_payment: "待付款",
    paid: "已撥款",
    paid_pending_doc: "待補件",
    pending_doc_review: "待補件審核",
    rejected: "已退件",
    cancelled: "已撤銷"
};

const EVENT_COPY = {
    submit: {
        headline: "有新的請款單待你審核",
        summary: "申請單已送出，請檢視金額與憑證資訊。",
        nextStep: "請於系統中完成核准或駁回。",
        subjectTag: "待辦"
    },
    withdraw: {
        headline: "申請人已撤回草稿",
        summary: "此單據已退回草稿狀態。",
        nextStep: "若需再次送審，申請人可於編輯後重新提交。",
        subjectTag: "通知"
    },
    approve_manager: {
        headline: "主管審核已通過",
        summary: "單據已進入財務審核流程。",
        nextStep: "請財務確認後續審核與付款安排。",
        subjectTag: "待辦"
    },
    reject_manager: {
        headline: "主管已駁回此請款單",
        summary: "請依駁回原因調整內容。",
        nextStep: "修正完成後可重新送審。",
        subjectTag: "待辦"
    },
    approve_finance: {
        headline: "財務審核已通過",
        summary: "單據已進入待付款流程。",
        nextStep: "請安排實際付款作業。",
        subjectTag: "待辦"
    },
    reject_finance: {
        headline: "財務已駁回此請款單",
        summary: "請依駁回原因修正後再送審。",
        nextStep: "修正完成後可重新提交審核。",
        subjectTag: "待辦"
    },
    reject_payment: {
        headline: "出納已退回此單據至財務審核",
        summary: "付款前檢查發現問題，需重新確認。",
        nextStep: "請財務修正後再次核准。",
        subjectTag: "待辦"
    },
    pay_completed: {
        headline: "付款已完成",
        summary: "此請款單已完成撥款。",
        nextStep: "可於系統查閱付款紀錄。",
        subjectTag: "通知"
    },
    pay_completed_need_doc: {
        headline: "付款已完成，請補件",
        summary: "此單據已先付款，仍有待補附件。",
        nextStep: "請申請人儘速補件並送審。",
        subjectTag: "待辦"
    },
    supplement_submitted: {
        headline: "補件已送審",
        summary: "申請人已提交補件，等待財務審核。",
        nextStep: "請財務確認補件內容。",
        subjectTag: "待辦"
    },
    supplement_approved: {
        headline: "補件審核已通過",
        summary: "本單據補件完成。",
        nextStep: "可於系統查閱完整歷程。",
        subjectTag: "通知"
    },
    supplement_rejected: {
        headline: "補件審核未通過",
        summary: "補件內容需再調整。",
        nextStep: "請依原因修正後重新送審。",
        subjectTag: "待辦"
    },
    cancelled: {
        headline: "請款單已撤銷",
        summary: "此單據流程已終止。",
        nextStep: "如需申請請建立新單。",
        subjectTag: "通知"
    },
    payment_reversed: {
        headline: "付款已沖帳",
        summary: "該付款已回退為待付款流程。",
        nextStep: "請確認後續處理方式。",
        subjectTag: "通知"
    }
};

function escapeHtml(input) {
    return String(input || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function withHost(baseUrl, path) {
    if (!path) return baseUrl;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

function toStatusLabel(status) {
    if (!status) return "-";
    return STATUS_LABELS[status] || status;
}

function getEventCopy(eventCode) {
    return (
        EVENT_COPY[eventCode] || {
            headline: "請款單狀態已更新",
            summary: "單據狀態已異動。",
            nextStep: "請至系統確認最新狀態。",
            subjectTag: "通知"
        }
    );
}

export function renderClaimEmailTemplate(templateKey, payload, appBaseUrl) {
    const _ = templateKey; // keep signature aligned with server template helper
    const eventLabel = EVENT_LABELS[payload.event_code] || payload.event_code || "狀態通知";
    const claimNo = payload.claim_id || "-";
    const actorName = payload.actor_name || "系統";
    const reason = String(payload.reason || "").trim();
    const claimTypeLabel = CLAIM_TYPE_LABELS[payload.claim_type || ""] || "-";
    const link = withHost(appBaseUrl, payload.claim_link_path || `/claims/${claimNo}`);
    const fromStatus = toStatusLabel(payload.from_status);
    const toStatus = toStatusLabel(payload.to_status);
    const statusLine =
        payload.from_status && payload.to_status ? `${fromStatus} → ${toStatus}` : toStatus || fromStatus || "-";
    const copy = getEventCopy(payload.event_code);

    const subject = `[報銷系統][${copy.subjectTag}] ${eventLabel}｜請款單 #${claimNo}`;
    const text = [
        `${copy.headline}`,
        `${copy.summary}`,
        `單號：#${claimNo}`,
        `類別：${claimTypeLabel}`,
        `狀態：${statusLine}`,
        `操作者：${actorName}`,
        reason ? `原因：${reason}` : "原因：-",
        `下一步：${copy.nextStep}`,
        `連結：${link}`
    ].join("\n");

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; line-height: 1.6;">
  <h2 style="margin: 0 0 6px; font-size: 18px;">${escapeHtml(copy.headline)}</h2>
  <p style="margin: 0 0 14px; color: #4b5563;">${escapeHtml(copy.summary)}</p>
  <p style="margin: 0 0 8px;"><strong>事件：</strong>${escapeHtml(eventLabel)}</p>
  <p style="margin: 0 0 8px;"><strong>單號：</strong>#${escapeHtml(claimNo)}</p>
  <p style="margin: 0 0 8px;"><strong>類別：</strong>${escapeHtml(claimTypeLabel)}</p>
  <p style="margin: 0 0 8px;"><strong>狀態：</strong>${escapeHtml(statusLine)}</p>
  <p style="margin: 0 0 8px;"><strong>操作者：</strong>${escapeHtml(actorName)}</p>
  <p style="margin: 0 0 8px;"><strong>原因：</strong>${escapeHtml(reason || "-")}</p>
  <p style="margin: 0 0 8px;"><strong>下一步：</strong>${escapeHtml(copy.nextStep)}</p>
  <p style="margin: 16px 0 0;"><a href="${escapeHtml(link)}">前往查看請款單</a></p>
</div>`.trim();

    return { subject, text, html };
}
