import { useState } from "react";
import { X, FileText, ImageIcon, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileViewer } from "./file-viewer";

interface LocalAttachedFile {
    file: File;
    preview?: string;
}

interface AttachedFileListProps {
    files: LocalAttachedFile[];
    onRemove?: (index: number) => void; // omit when read-only
}

export function AttachedFileList({ files, onRemove }: AttachedFileListProps) {
    const [viewerIndex, setViewerIndex] = useState<number | null>(null);

    if (files.length === 0) return null;

    function getFileIcon(file: File) {
        if (file.type.startsWith('image/')) return <ImageIcon size={16} className="text-blue-500" />;
        if (file.type === 'application/pdf') return <FileText size={16} className="text-red-500" />;
        return <File size={16} className="text-muted-foreground" />;
    }

    function formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    // Convert local File objects to ViewableFile for the viewer
    const viewableFiles = files.map(f => ({
        name: f.file.name,
        url: f.preview ?? URL.createObjectURL(f.file),
        mime_type: f.file.type,
        size: f.file.size,
    }));

    return (
        <>
            <div className="space-y-2">
                {files.map((attached, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-3 p-2 border rounded-md bg-muted/20 group hover:border-primary *:cursor-pointer"
                    >
                        {/* Clickable thumbnail/icon */}
                        <button
                            type="button"
                            onClick={() => setViewerIndex(index)}
                            className="flex-shrink-0 focus:outline-none"
                            title="Click to preview"
                        >
                            {attached.preview ? (
                                <img
                                    src={attached.preview}
                                    alt={attached.file.name}
                                    className="w-10 h-10 object-cover rounded-sm hover:opacity-80 transition-opacity"
                                />
                            ) : (
                                <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-sm hover:bg-muted/70 transition-colors">
                                    {getFileIcon(attached.file)}
                                </div>
                            )}
                        </button>

                        {/* Name + size — also clickable */}
                        <button
                            type="button"
                            onClick={() => setViewerIndex(index)}
                            className="flex-1 min-w-0 text-left hover:underline focus:outline-none"
                        >
                            <p className="text-sm font-medium truncate">{attached.file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(attached.file.size)}</p>
                        </button>

                        {/* Remove button — only shown if onRemove provided */}
                        {onRemove && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onRemove(index)}
                                className="text-muted-foreground hover:text-destructive flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={14} />
                            </Button>
                        )}
                    </div>
                ))}
            </div>

            {viewerIndex !== null && (
                <FileViewer
                    files={viewableFiles}
                    initialIndex={viewerIndex}
                    onClose={() => setViewerIndex(null)}
                />
            )}
        </>
    );
}