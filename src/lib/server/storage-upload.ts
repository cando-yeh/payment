type UploadTarget = {
    bucket: string;
    folder?: string;
    prefix: string;
};

export function validateFileUpload(
    file: File | null | undefined,
    label: string,
    options: {
        required?: boolean;
        maxBytes: number;
        allowedTypes: Set<string>;
    }
): void {
    if (!file || file.size === 0) {
        if (options.required) {
            throw new Error(`請上傳${label}`);
        }
        return;
    }

    if (!options.allowedTypes.has(file.type)) {
        throw new Error(`${label} 格式不支援`);
    }

    if (file.size > options.maxBytes) {
        throw new Error(`${label} 檔案過大`);
    }
}

export async function uploadFileToStorage(
    supabase: App.Locals['supabase'],
    file: File,
    target: UploadTarget
): Promise<string> {
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const fileName = `${target.prefix}_${crypto.randomUUID()}.${extension}`;
    const baseFolder = target.folder || 'uploads';
    const filePath = `${baseFolder}/${crypto.randomUUID()}/${fileName}`;

    const { data, error } = await supabase.storage.from(target.bucket).upload(filePath, file, {
        upsert: false,
        contentType: file.type
    });

    if (error || !data) {
        throw new Error(error?.message || '檔案上傳失敗');
    }

    return data.path;
}
