import { X, Download, FileText, ImageIcon, File, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
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
    const [googleViewerFailed, setGoogleViewerFailed] = useState(false);
    const [googleViewerLoaded, setGoogleViewerLoaded] = useState(false);

    // Reset per-file state whenever the current file changes
    useEffect(() => {
        setBrokenPreview(false);
        setGoogleViewerFailed(false);
        setGoogleViewerLoaded(false);
    }, [currentIndex]);

    // Google Docs Viewer — reliable cross-browser PDF rendering that bypasses
    // X-Frame-Options and CORS issues from storage providers.
    const googleDocsViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(current.url)}&embedded=true`;

    // Compute a preview-friendly URL for images hosted on Cloudinary.
    function computePreviewUrl(url: string, mimeType?: string) {
        try {
            if (mimeType === 'application/pdf' || /\.pdf($|\?)/i.test(url)) return url;
            if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
                if (!url.includes('/upload/f_') && !url.includes('/upload/f_auto')) {
                    return url.replace('/upload/', '/upload/f_auto,q_auto/');
                }
            }
            return url;
        } catch {
            return url;
        }
    }

    const previewUrl = computePreviewUrl(current.url, current.mime_type);

    function prev() {
        setCurrentIndex(i => Math.max(0, i - 1));
    }
    function next() {
        setCurrentIndex(i => Math.min(files.length - 1, i + 1));
    }

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
                    <span className="text-sm font-medium truncate">{current.original_name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {isPdf && (
                        <a href={current.url} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="sm" title="Open PDF in new tab">
                                <ExternalLink size={16} />
                            </Button>
                        </a>
                    )}
                    <a href={current.url} download={current.name} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="sm" title="Download">
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

                {/* Image */}
                {isImage && !brokenPreview && (
                    <img
                        src={encodeURI(previewUrl)}
                        alt={current.name}
                        className="max-h-full max-w-full object-contain select-none"
                        onError={() => setBrokenPreview(true)}
                    />
                )}

                {/* PDF */}
                {isPdf && !brokenPreview && (
                    <div className="w-full h-full bg-muted">
                        <iframe
                            src={current.url}
                            title={current.name}
                            className="w-full h-full border-0"
                            onError={() => setBrokenPreview(true)}
                        />
                    </div>
                )}

                {/* Fallback: unknown type, broken image, or Google Docs viewer gave up */}
                {(brokenPreview || (!isImage && !isPdf)) && (
                    <div className="flex flex-col items-center gap-4 text-center p-8">
                        {isPdf
                            ? <FileText size={48} className="text-red-400" />
                            : <File size={48} className="text-muted-foreground" />
                        }
                        <p className="text-sm text-muted-foreground">
                            {isPdf
                                ? 'Unable to preview this PDF in the browser.'
                                : 'Preview not available for this file type.'
                            }
                        </p>
                        <div className="flex gap-3">
                            {isPdf && (
                                <a href={current.url} target="_blank" rel="noreferrer">
                                    <Button variant="outline">
                                        <ExternalLink size={16} className="mr-2" />
                                        Open in new tab
                                    </Button>
                                </a>
                            )}
                            <a href={current.url} download={current.name} target="_blank" rel="noreferrer">
                                <Button variant="secondary">
                                    <Download size={16} className="mr-2" />
                                    Download
                                </Button>
                            </a>
                        </div>
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

            {/* Thumbnail strip */}
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
                                <img
                                    src={encodeURI(computePreviewUrl(f.url, f.mime_type))}
                                    alt={f.name}
                                    className="w-full h-full object-cover"
                                    onError={e => { (e.currentTarget as HTMLImageElement).src = f.url; }}
                                />
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