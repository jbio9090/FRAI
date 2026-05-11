import { X, Download, FileText, ImageIcon, File, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ViewableFile {
    name: string;
    url: string;
    mime_type: string;
    size?: number;
    original_name: string;
}

interface FileViewerProps {
    files: ViewableFile[];
    initialIndex?: number;
    onClose: () => void | null;
}

export function FileViewer({ files, initialIndex = 0, onClose }: FileViewerProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const current = files[currentIndex];

    const isImage = current.mime_type.startsWith('image/');
    const isPdf = current.mime_type === 'application/pdf';
    const [brokenPreview, setBrokenPreview] = useState(false);

    // Compute a preview-friendly URL. For Cloudinary URLs we insert quality/format hints
    // so images and PDFs load reliably in the browser.
    function computePreviewUrl(url: string, mimeType?: string) {
        try {
            const decoded = url;
            // For PDFs, return original URL — avoid Cloudinary transforming to first-page image
            if (mimeType && mimeType === 'application/pdf') {
                return decoded;
            }
            if (/\.pdf($|\?)/i.test(decoded)) {
                return decoded;
            }
            // If this looks like a Cloudinary upload URL, inject f_auto,q_auto for better rendering
            if (decoded.includes('res.cloudinary.com') && decoded.includes('/upload/')) {
                // avoid inserting twice
                if (!decoded.includes('/upload/f_') && !decoded.includes('/upload/f_auto')) {
                    return decoded.replace('/upload/', '/upload/f_auto,q_auto/');
                }
            }
            return decoded;
        } catch (e) {
            return url;
        }
    }

    const previewUrl = computePreviewUrl(current.url, current.mime_type);

    function prev() { setBrokenPreview(false); setCurrentIndex(i => Math.max(0, i - 1)); }
    function next() { setBrokenPreview(false); setCurrentIndex(i => Math.min(files.length - 1, i + 1)); }

    // Keyboard nav
    function handleKey(e: React.KeyboardEvent) {
        if (e.key === 'ArrowLeft') prev();
        if (e.key === 'ArrowRight') next();
        if (e.key === 'Escape') onClose();
    }

    return (
        <div
            className="fixed inset-0 z-50 bg-black/80 flex flex-col"
            onClick={onClose}
            onKeyDown={handleKey}
            tabIndex={0}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 bg-foreground/90 text-background/90 dark:bg-background/90 dark:text-foreground/90 backdrop-blur flex-shrink-0"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 min-w-0">
                    {files.length > 1 && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                            {currentIndex + 1} / {files.length}
                        </span>
                    )}
                    <span className="text-sm font-medium truncate text-background">{current.original_name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <a href={current.url} download={current.name} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="sm">
                            <Download size={16} />
                        </Button>
                    </a>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X size={16} />
                    </Button>
                </div>
            </div>

            {/* Main content */}
            <div
                className="flex-1 flex items-center justify-center overflow-hidden relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Prev button */}
                {files.length > 1 && currentIndex > 0 && (
                    <button
                        onClick={prev}
                        className="absolute left-4 z-10 bg-background/80 hover:bg-background rounded-full p-2 backdrop-blur"
                    >
                        <ChevronLeft size={20} />
                    </button>
                )}

                {/* File display */}
                {isImage && !brokenPreview && (
                    <img
                        src={encodeURI(previewUrl)}
                        alt={current.name}
                        className="max-h-full max-w-full object-contain select-none"
                        onError={() => setBrokenPreview(true)}
                    />
                )}

                {isPdf && !brokenPreview && (
                    <iframe
                        src={encodeURI(previewUrl)}
                        className="w-full h-full"
                        title={current.name}
                        onError={() => setBrokenPreview(true)}
                    />
                )}

                {(brokenPreview || (!isImage && !isPdf)) && (
                    <div className="flex flex-col items-center gap-4 text-center p-8">
                        <File size={48} className="text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Preview not available for this file. You can download it instead.</p>
                        <a href={current.url} download={current.name} target="_blank" rel="noreferrer">
                            <Button variant="secondary">
                                <Download size={16} className="mr-2" />
                                Download {current.name}
                            </Button>
                        </a>
                    </div>
                )}

                {/* Next button */}
                {files.length > 1 && currentIndex < files.length - 1 && (
                    <button
                        onClick={next}
                        className="absolute right-4 z-10 bg-background/80 hover:bg-background rounded-full p-2 backdrop-blur"
                    >
                        <ChevronRight size={20} />
                    </button>
                )}
            </div>

            {/* Thumbnail strip — shown when multiple files */}
            {files.length > 1 && (
                <div
                    className="flex gap-2 px-4 py-3 bg-foreground/90 text-background/90 dark:bg-background/90 dark:text-foreground/90 backdrop-blur border-t overflow-x-auto flex-shrink-0"
                    onClick={e => e.stopPropagation()}
                >
                            {files.map((f, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrentIndex(i)}
                            className={cn(
                                "w-14 h-14 rounded-md border-2 flex-shrink-0 overflow-hidden transition-colors",
                                i === currentIndex ? "border-primary" : "border-transparent hover:border-muted-foreground/50"
                            )}
                        >
                                    {f.mime_type.startsWith('image/') ? (
                                        <img src={encodeURI(computePreviewUrl(f.url, f.mime_type))} alt={f.name} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = f.url; }} />
                                    ) : (
                                <div className="w-full h-full flex items-center justify-center bg-muted">
                                    {f.mime_type === 'application/pdf'
                                        ? <FileText size={20} className="text-red-500" />
                                        : <File size={20} className="text-muted-foreground" />
                                    }
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
} 