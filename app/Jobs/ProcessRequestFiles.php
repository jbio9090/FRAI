<?php

namespace App\Jobs;

use App\Models\RequestFile;
use App\Services\StorageService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ProcessRequestFiles implements ShouldQueue, ShouldQueueAfterCommit
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 300;

    public int $maxExceptions = 2;

    public function __construct(
        public RequestFile $file
    ) {}

    public function backoff(): array
    {
        return [10, 30];
    }

    public function handle(StorageService $storage): void
    {
        if (
            str_starts_with($this->file->path, 'https://') ||
            str_starts_with($this->file->path, 'cloudinary://')
        ) {
            return;
        }

        try {
            $meta = $storage->uploadRequestFileFromLocalPath($this->file->path, 'request-files');
        } catch (\Throwable $e) {
            Log::error('ProcessRequestFiles: upload failed for RequestFile#'.$this->file->id.': '.$e->getMessage());
            $this->fail($e);

            return;
        }

        $this->file->update([
            'path' => $meta['path'],
            'mime_type' => $meta['mime_type'] ?? $this->file->mime_type,
            'size' => $meta['size'] ?? $this->file->size,
        ]);

        if ($this->file->getOriginal('path') !== $this->file->path) {
            Storage::disk('public')->delete($this->file->getOriginal('path'));
        }
    }
}
