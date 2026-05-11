import { X, FileText, ImageIcon, File } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileViewer } from './file-viewer';

interface LocalAttachedFile {
    file: File;
    preview?: string;
    original_name: string;
    mime_type: string;
    size: number;
    url: string;
}

interface ServerAttachedFile {
    path: string;
    original_name: string;
    mime_type: string;
    size: number;
    url: string;
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
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            webp: 'image/webp',
            pdf: 'application/pdf',
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
    const localViewable = files.map((f) => ({
        name: f.file.name,
        url: f.preview ?? URL.createObjectURL(f.file),
        mime_type: f.file.type,
        size: f.file.size,
        isLocal: true as const,
        original_name: f.original_name,
    }));

    const serverViewable = serverFiles.map((f) => ({
        name: getFilenameFromPath(f.original_name ?? f.path),
        url: f.url ?? `/storage/${f.path}`,
        mime_type: f.mime_type ?? getMimeTypeFromPath(f.path),
        size: f.size ?? null as number | null,
        isLocal: false as const,
        original_name: f.original_name,
    }));

    const allViewable = [...localViewable, ...serverViewable];

    return (
        <>
            <div className="space-y-2">
                {/* Local files */}
                {files.map((attached, index) => (
                    <div
                        key={`local-${index}`}
                        className="group flex items-center gap-3 rounded-md border bg-muted/20 p-2 *:cursor-pointer hover:border-primary"
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
                                    className="h-10 w-10 rounded-sm object-cover transition-opacity hover:opacity-80"
                                />
                            ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-muted transition-colors hover:bg-muted/70">
                                    {getFileIcon(attached.file.type)}
                                </div>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setViewerIndex(index)}
                            className="min-w-0 flex-1 text-left hover:underline focus:outline-none"
                        >
                            <p className="truncate text-sm font-medium">{attached.file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(attached.file.size)}</p>
                        </button>

                        {onRemove && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onRemove(index)}
                                className="flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                            >
                                <X size={14} />
                            </Button>
                        )}
                    </div>
                ))}

                {/* Server files */}
                {serverFiles.map((attached, index) => {
                    const mime = attached.mime_type ?? getMimeTypeFromPath(attached.path);
                    const name = attached.original_name ?? getFilenameFromPath(attached.path);
                    const url = attached.url ?? `/storage/${attached.path}`;
                    const viewerIdx = files.length + index; // offset past local files

                    return (
                        <div
                            key={`server-${index}`}
                            className="group flex items-center gap-3 rounded-md border bg-muted/20 p-2 *:cursor-pointer hover:border-primary"
                        >
                            <button
                                type="button"
                                onClick={() => setViewerIndex(viewerIdx)}
                                className="flex-shrink-0 focus:outline-none"
                                title="Click to preview"
                            >
                                {mime.startsWith('image/') ? (
                                    <img src={url} alt={name} className="h-10 w-10 rounded-sm object-cover transition-opacity hover:opacity-80" />
                                ) : (
                                    <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-muted transition-colors hover:bg-muted/70">
                                        {getFileIcon(mime)}
                                    </div>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setViewerIndex(viewerIdx)}
                                className="min-w-0 flex-1 text-left hover:underline focus:outline-none"
                            >
                                <p className="truncate text-sm font-medium">{name}</p>
                            </button>
                        </div>
                    );
                })}
            </div>

            {viewerIndex !== null && <FileViewer files={allViewable} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />}
        </>
    );
}
