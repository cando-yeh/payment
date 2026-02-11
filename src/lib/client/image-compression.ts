const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type CompressOptions = {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    maxBytes?: number;
};

export async function compressImageFile(
    file: File,
    options: CompressOptions = {}
): Promise<File> {
    const maxWidth = options.maxWidth ?? 1600;
    const maxHeight = options.maxHeight ?? 1600;
    const quality = options.quality ?? 0.82;
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

    if (!IMAGE_TYPES.has(file.type) || file.size <= maxBytes) {
        return file;
    }

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    const width = Math.max(1, Math.floor(bitmap.width * scale));
    const height = Math.max(1, Math.floor(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return file;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), 'image/jpeg', quality);
    });

    if (!blob || blob.size >= file.size) {
        return file;
    }

    const compressedName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], compressedName, {
        type: 'image/jpeg',
        lastModified: Date.now()
    });
}

export async function compressFormImageInputs(
    form: HTMLFormElement,
    names: string[],
    options: CompressOptions = {}
): Promise<string[]> {
    const changed: string[] = [];

    for (const name of names) {
        const input = form.elements.namedItem(name) as HTMLInputElement | null;
        if (!input || input.type !== 'file' || !input.files || input.files.length === 0) {
            continue;
        }

        const original = input.files[0];
        const compressed = await compressImageFile(original, options);
        if (compressed === original) {
            continue;
        }

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(compressed);
        input.files = dataTransfer.files;
        changed.push(name);
    }

    return changed;
}
