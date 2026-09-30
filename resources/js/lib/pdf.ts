const A4_LANDSCAPE_WIDTH_PT = 842;
const A4_LANDSCAPE_HEIGHT_PT = 595;
const DEFAULT_MARGIN_PT = 24;

const PDF_VERSION = '1.4';
const CATALOG_OBJECT = 1;
const PAGES_OBJECT = 2;
const PAGE_OBJECT = 3;
const IMAGE_OBJECT = 4;
const CONTENT_OBJECT = 5;
const OBJECT_COUNT = 6;

const FREE_XREF_ENTRY = '0000000000 65535 f \n';

export interface PdfImageOptions {
    pageWidthPt?: number;
    pageHeightPt?: number;
    marginPt?: number;
    title?: string;
}

interface PdfImageSize {
    width: number;
    height: number;
}

const encoder = new TextEncoder();

const dataUrlToBytes = (dataUrl: string): Uint8Array => {
    const separatorIndex = dataUrl.indexOf(',');

    if (separatorIndex === -1) {
        throw new Error('Invalid image data URL: missing payload separator.');
    }

    const binary = atob(dataUrl.slice(separatorIndex + 1));
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
};

const loadImageSize = (dataUrl: string): Promise<PdfImageSize> =>
    new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('Unable to read the captured image dimensions.'));
        image.src = dataUrl;
    });

const toPdfTextString = (value: string): string => {
    const bytes = new Uint8Array(2 + value.length * 2);

    bytes[0] = 0xfe;
    bytes[1] = 0xff;

    for (let i = 0; i < value.length; i++) {
        bytes[2 + i * 2] = value.charCodeAt(i) >> 8;
        bytes[3 + i * 2] = value.charCodeAt(i) & 0xff;
    }

    let hex = '';

    for (const byte of bytes) {
        hex += byte.toString(16).padStart(2, '0');
    }

    return `<${hex}>`;
};

/**
 * Wraps a captured JPEG as a single-page PDF. The image is embedded with the native
 * /DCTDecode filter, which is why the capture step must produce a JPEG rather than a PNG.
 */
export async function jpegToPdf(dataUrl: string, options: PdfImageOptions = {}): Promise<Blob> {
    if (!dataUrl.startsWith('data:image/jpeg')) {
        throw new Error('Expected a JPEG data URL.');
    }

    const pageWidthPt = options.pageWidthPt ?? A4_LANDSCAPE_WIDTH_PT;
    const pageHeightPt = options.pageHeightPt ?? A4_LANDSCAPE_HEIGHT_PT;
    const marginPt = options.marginPt ?? DEFAULT_MARGIN_PT;

    const [imageBytes, imageSize] = await Promise.all([Promise.resolve(dataUrlToBytes(dataUrl)), loadImageSize(dataUrl)]);

    if (imageSize.width === 0 || imageSize.height === 0) {
        throw new Error('Captured image has no dimensions.');
    }

    const availableWidth = pageWidthPt - marginPt * 2;
    const availableHeight = pageHeightPt - marginPt * 2;
    const scale = Math.min(availableWidth / imageSize.width, availableHeight / imageSize.height);
    const drawWidth = imageSize.width * scale;
    const drawHeight = imageSize.height * scale;
    const offsetX = (pageWidthPt - drawWidth) / 2;
    const offsetY = (pageHeightPt - drawHeight) / 2;

    const contentStream = [
        'q',
        `${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${offsetX.toFixed(2)} ${offsetY.toFixed(2)} cm`,
        '/Im0 Do',
        'Q',
    ].join('\n');

    const chunks: Uint8Array[] = [];
    const offsets: number[] = new Array(OBJECT_COUNT).fill(0);
    let byteLength = 0;

    const pushText = (text: string): void => {
        const bytes = encoder.encode(text);
        chunks.push(bytes);
        byteLength += bytes.length;
    };

    const pushBytes = (bytes: Uint8Array): void => {
        chunks.push(bytes);
        byteLength += bytes.length;
    };

    const beginObject = (objectNumber: number, body: string): void => {
        offsets[objectNumber] = byteLength;
        pushText(`${objectNumber} 0 obj\n${body}\n`);
    };

    pushText(`%PDF-${PDF_VERSION}\n`);
    pushText('%\xE2\xE3\xCF\xD3\n');

    beginObject(CATALOG_OBJECT, `<< /Type /Catalog /Pages ${PAGES_OBJECT} 0 R >>`);
    beginObject(PAGES_OBJECT, `<< /Type /Pages /Kids [${PAGE_OBJECT} 0 R] /Count 1 >>`);
    beginObject(
        PAGE_OBJECT,
        `<< /Type /Page /Parent ${PAGES_OBJECT} 0 R /MediaBox [0 0 ${pageWidthPt} ${pageHeightPt}] ` +
            `/Resources << /XObject << /Im0 ${IMAGE_OBJECT} 0 R >> >> /Contents ${CONTENT_OBJECT} 0 R >>`,
    );

    offsets[IMAGE_OBJECT] = byteLength;
    pushText(
        `${IMAGE_OBJECT} 0 obj\n` +
            `<< /Type /XObject /Subtype /Image /Width ${imageSize.width} /Height ${imageSize.height} ` +
            `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
    );
    pushBytes(imageBytes);
    pushText('\nendstream\nendobj\n');

    offsets[CONTENT_OBJECT] = byteLength;
    pushText(`${CONTENT_OBJECT} 0 obj\n<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}\nendstream\nendobj\n`);

    const xrefOffset = byteLength;

    let xref = `xref\n0 ${OBJECT_COUNT}\n${FREE_XREF_ENTRY}`;

    for (let objectNumber = 1; objectNumber < OBJECT_COUNT; objectNumber++) {
        // Each xref entry must be exactly 20 bytes: 10-digit offset, space, 5-digit generation, space, 'n', space, newline.
        xref += `${String(offsets[objectNumber]).padStart(10, '0')} 00000 n \n`;
    }

    const infoObject = options.title ? ` /Info << /Title ${toPdfTextString(options.title)} >>` : '';

    pushText(`${xref}trailer\n<< /Size ${OBJECT_COUNT} /Root ${CATALOG_OBJECT} 0 R${infoObject} >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    // Concatenate into one contiguous buffer: Blob rejects the widened
    // `Uint8Array<ArrayBufferLike>` view that the chunk list would otherwise carry.
    const file = new Uint8Array(byteLength);
    let writeOffset = 0;

    for (const chunk of chunks) {
        file.set(chunk, writeOffset);
        writeOffset += chunk.length;
    }

    return new Blob([file], { type: 'application/pdf' });
}

export function downloadPdf(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export async function downloadCalendarPdf(dataUrl: string, filename: string, title?: string): Promise<void> {
    const blob = await jpegToPdf(dataUrl, { title });

    downloadPdf(blob, filename);
}
