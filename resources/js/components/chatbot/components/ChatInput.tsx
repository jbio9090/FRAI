import React, { useEffect, useRef } from 'react';
import type { AttachedFileInfo } from '../types';

interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onKeyPress: (e: React.KeyboardEvent) => void;
    onSend: () => void;
    disabled: boolean;
    placeholder?: string;
    attachedFiles?: AttachedFileInfo[];
    uploading?: boolean;
    uploadError?: string | null;
    onAttachFile?: (files: FileList) => void;
    onRemoveFile?: (fileId: string) => void;
    autoFocus?: boolean;
}

export default function ChatInput({
    value,
    onChange,
    onKeyPress,
    onSend,
    disabled,
    placeholder = 'Type your message...',
    attachedFiles = [],
    uploading = false,
    uploadError = null,
    onAttachFile,
    onRemoveFile,
    autoFocus = false,
}: ChatInputProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (autoFocus && !disabled) {
            textareaRef.current?.focus();
        }
    }, [autoFocus, disabled]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && onAttachFile) {
            onAttachFile(e.target.files);
            e.target.value = '';
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="border-t border-border bg-background p-3 sm:p-4 lg:p-6">
            {attachedFiles.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm font-semibold text-blue-900 mb-2">
                        Attached Files ({attachedFiles.length})
                    </div>
                    <div className="space-y-2">
                        {attachedFiles.map((file) => (
                            <div
                                key={file.id}
                                className="flex items-center justify-between bg-white p-2 rounded border border-blue-100"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-gray-800 truncate">
                                        {file.name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {formatFileSize(file.size)}
                                    </div>
                                </div>
                                {onRemoveFile && (
                                    <button
                                        onClick={() => onRemoveFile(file.id)}
                                        disabled={uploading}
                                        className="ml-2 px-2 py-1 text-red-600 hover:text-red-800 disabled:opacity-50 text-xs font-semibold"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {uploadError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-sm text-red-800">{uploadError}</div>
                </div>
            )}

            {uploading && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="text-sm text-amber-800 flex items-center gap-2">
                        <span className="inline-block animate-spin">⏳</span>
                        Uploading files...
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyPress={onKeyPress}
                    disabled={disabled}
                    placeholder={placeholder}
                    rows={1}
                    className="w-full flex-1 resize-none rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 focus:outline-none disabled:opacity-50 min-h-[44px] max-h-40"
                />
                
                <button
                    onClick={onSend}
                    disabled={disabled || !value.trim()}
                    className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-bold tracking-wide text-primary-foreground uppercase transition-all duration-200 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-6"
                >
                    Send
                </button>

                {onAttachFile && (
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                            onChange={handleFileSelect}
                            disabled={disabled || uploading}
                            style={{ display: 'none' }}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={disabled || uploading}
                            title="Attach files"
                            className="w-full rounded-lg bg-gray-200 px-4 py-3 text-lg font-bold text-gray-800 transition-all duration-200 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                        >
                            📎{attachedFiles.length > 0 && <span className="ml-1 text-xs">({attachedFiles.length})</span>}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
