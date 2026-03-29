import { useState } from "react";
import { X, FileText, ImageIcon, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileViewer } from "./file-viewer";

interface LocalAttachedFile {
    file: File;
    preview?: string;
}

interface ServerAttachedFile {
    path: string;
    original_name: string;
}

interface AttachedFileListProps {
    files?: LocalAttachedFile[];
    serverFiles?: ServerAttachedFile[];
    onRemove?: (index: number) => void | null;
}

export function AttachedFileList({ files = [], serverFiles = [], onRemove }: AttachedFileListProps) {
    const [viewerIndex, setViewerIndex] = useState<number | null>(null);

    if (files.length === 0 && serverFiles.length === 0) return null;

    function getFileIcon(mimeType: string) {
        if (mimeType.startsWith('image/')) return <ImageIcon size={16} className="text-blue-500" />;
        if (mimeType === 'application/pdf') return <FileText size={16} className="text-red-500" />;
        return <File size={16} className="text-muted-foreground" />;
    }

    function getMimeTypeFromPath(path: string): string {
        const ext = path.split('.').pop()?.toLowerCase();
        const map: Record<string, string> = {
            png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
            gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
        };
        return map[ext ?? ''] ?? 'application/octet-stream';
    }

    function getFilenameFromPath(path: string): string {
        return path.split('/').pop() ?? path;
    }

    function formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    // Merge local + server files into a unified viewable list
    // Local files come first, server files after
    const localViewable = files.map(f => ({
        name: f.file.name,
        url: f.preview ?? URL.createObjectURL(f.file),
        mime_type: f.file.type,
        size: f.file.size,
        isLocal: true as const,
    }));

    const serverViewable = serverFiles.map(f => ({
        name: getFilenameFromPath(f.path),
        url: `/storage/${f.path}`,
        mime_type: getMimeTypeFromPath(f.path),
        size: null as number | null,
        isLocal: false as const,
    }));

    const allViewable = [...localViewable, ...serverViewable];

    return (
        <>
            <div className="space-y-2">
                {/* Local files */}
                {files.map((attached, index) => (
                    <div
                        key={`local-${index}`}
                        className="flex items-center gap-3 p-2 border rounded-md bg-muted/20 group hover:border-primary *:cursor-pointer"
                    >
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
                                    {getFileIcon(attached.file.type)}
                                </div>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setViewerIndex(index)}
                            className="flex-1 min-w-0 text-left hover:underline focus:outline-none"
                        >
                            <p className="text-sm font-medium truncate">{attached.file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(attached.file.size)}</p>
                        </button>

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

                {/* Server files */}
                {serverFiles.map((attached, index) => {
                    const mime = getMimeTypeFromPath(attached.path);
                    const name = getFilenameFromPath(attached.original_name);
                    const url = `/storage/${attached.path}`;
                    const viewerIdx = files.length + index; // offset past local files

                    return (
                        <div
                            key={`server-${index}`}
                            className="flex items-center gap-3 p-2 border rounded-md bg-muted/20 group hover:border-primary *:cursor-pointer"
                        >
                            <button
                                type="button"
                                onClick={() => setViewerIndex(viewerIdx)}
                                className="flex-shrink-0 focus:outline-none"
                                title="Click to preview"
                            >
                                {mime.startsWith('image/') ? (
                                    <img
                                        src={url}
                                        alt={name}
                                        className="w-10 h-10 object-cover rounded-sm hover:opacity-80 transition-opacity"
                                    />
                                ) : (
                                    <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-sm hover:bg-muted/70 transition-colors">
                                        {getFileIcon(mime)}
                                    </div>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setViewerIndex(viewerIdx)}
                                className="flex-1 min-w-0 text-left hover:underline focus:outline-none"
                            >
                                <p className="text-sm font-medium truncate">{name}</p>
                            </button>
                        </div>
                    );
                })}
            </div>

            {viewerIndex !== null && (
                <FileViewer
                    files={allViewable}
                    initialIndex={viewerIndex}
                    onClose={() => setViewerIndex(null)}
                />
            )}
        </>
    );
}