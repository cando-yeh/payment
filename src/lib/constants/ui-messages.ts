export const UI_MESSAGES = {
    common: {
        actionFailed: "操作失敗：請稍後再試。",
        submitFailed: "提交失敗：請稍後再試。",
        updateFailed: "更新失敗：請稍後再試。",
        deleteFailed: "刪除失敗：請稍後再試。",
        loadFailed: "讀取失敗：請稍後再試。",
        readFailed(target = "資料") {
            return `讀取${target}失敗：請稍後再試。`;
        },
        networkFailed(action = "操作") {
            return `${action}失敗：連線中斷，請稍後再試。`;
        },
    },
    claim: {
        submitted: "已送出審核",
        supplementSubmitted: "已送出補件審核",
        approverRequired:
            "尚未設定核准人，無法直接提交。請先聯繫管理員設定。",
        exemptReasonRequired(index: number) {
            return `第 ${index} 筆明細選擇無憑證時必須填寫理由`;
        },
        uploadRequired(index: number) {
            return `第 ${index} 筆明細選擇上傳憑證，請先選擇附件`;
        },
    },
    attachment: {
        uploadSuccess: "附件上傳成功",
        uploadFailed: "附件上傳失敗：請稍後再試。",
        deleteSuccess: "附件已刪除",
        deleteFailed: "附件刪除失敗：請稍後再試。",
    },
    user: {
        deactivated: "使用者已停用",
        reactivated: "使用者已重新啟用",
        deleted: "使用者已永久刪除",
        deactivateFailed: "停用使用者失敗：請稍後再試。",
        reactivateFailed: "重新啟用失敗：請稍後再試。",
        deleteFailed: "永久刪除失敗：請稍後再試。",
        profileUpdated: "使用者資料已更新",
        selfProfileUpdated: "個人資料已成功更新",
        nameRequired: "姓名不可為空",
        bankFieldsRequired: "請完整填寫銀行代碼與銀行帳號",
        accountReadFailed: "無法讀取帳號資訊",
    },
    payee: {
        requestSubmitted: "收款人申請已提交，請等待財務審核。",
        requestWithdrawn: "申請已撤銷",
        deleted: "收款人已永久刪除",
        disableRequested: "停用申請已提交，請等待財務審核",
        updateRequestSubmitted: "更新申請已提交，請等待財務審核。",
        noChanges: "至少需修改一項資料後才能提交異動申請",
        statusToggled(action: string) {
            return `已${action}`;
        },
        statusToggleFailed(action: string) {
            return `${action}收款人失敗：請稍後再試。`;
        },
        accountReadFailed: "讀取帳號失敗：請稍後再試。",
    },
    approval: {
        batchPayDone: "批次撥款已完成",
        batchPayFailed: "批次撥款失敗：請稍後再試。",
    },
} as const;
