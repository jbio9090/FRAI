<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class StorageService
{
    protected bool $useCloudinary = false;
    protected ?CloudinaryUploader $cloudinary = null;

    public function __construct()
    {
        $this->useCloudinary = ! empty(env('CLOUDINARY_URL'));
        // Do not instantiate CloudinaryUploader here — delay until it's
        // actually needed to avoid any potential Admin API calls or
        // expensive setup on every request.
        $this->cloudinary = null;
    }

    private function ensureCloudinary(): void
    {
        if ($this->cloudinary || ! $this->useCloudinary) {
            return;
        }

        try {
            $this->cloudinary = new CloudinaryUploader();
        } catch (\Throwable $e) {
            $this->useCloudinary = false;
            $this->cloudinary = null;
        }
    }

    public function uploadProfileFromUploadedFile(UploadedFile $file): string
    {
        $this->ensureCloudinary();
        if ($this->useCloudinary && $this->cloudinary) {
            $res = $this->cloudinary->uploadFile($file, 'profiles');
            return $res['secure_url'] ?? $res['url'] ?? '';
        }

        $path = $file->store('profiles', 'public');
        return basename($path);
    }

    public function uploadProfileFromPath(string $localPath): string
    {
        $this->ensureCloudinary();
        if ($this->useCloudinary && $this->cloudinary) {
            $res = $this->cloudinary->uploadFile($localPath, 'profiles');
            return $res['secure_url'] ?? $res['url'] ?? '';
        }

        $contents = file_get_contents($localPath);
        $filename = basename($localPath);
        Storage::disk('public')->put('profiles/' . $filename, $contents);
        return $filename;
    }

    /**
     * Upload a request/file attachment from an UploadedFile and return metadata array
     */
    public function uploadRequestFileFromUploadedFile(UploadedFile $file, string $folder = 'request-files'): array
    {
        $this->ensureCloudinary();
        if ($this->useCloudinary && $this->cloudinary) {
            $res = $this->cloudinary->uploadFile($file, $folder);
            $resource = $res['resource_type'] ?? 'raw';
            $publicId = $res['public_id'] ?? null;
            $format = $res['format'] ?? null;
            $path = "cloudinary://{$resource}/{$publicId}" . ($format ? ".{$format}" : '');

            return [
                'path' => $path,
                'url' => $res['secure_url'] ?? $res['url'] ?? null,
                'mime_type' => $file->getClientMimeType(),
                'size' => $res['bytes'] ?? $file->getSize(),
            ];
        }

        $path = $file->store($folder, 'public');
        return [
            'path' => $path,
            'url' => Storage::disk('public')->url($path),
            'mime_type' => $file->getClientMimeType(),
            'size' => $file->getSize(),
        ];
    }

    /**
     * Upload a request file from an existing local storage path (relative to storage/app/public)
     */
    public function uploadRequestFileFromLocalPath(string $relativePath, string $folder = 'request-files'): array
    {
        $full = storage_path('app/public/' . ltrim($relativePath, '/'));
        if (! file_exists($full)) {
            throw new \RuntimeException("Local file not found: {$full}");
        }

        $this->ensureCloudinary();
        if ($this->useCloudinary && $this->cloudinary) {
            $res = $this->cloudinary->uploadFile($full, $folder);
            $resource = $res['resource_type'] ?? 'raw';
            $publicId = $res['public_id'] ?? null;
            $format = $res['format'] ?? null;
            $path = "cloudinary://{$resource}/{$publicId}" . ($format ? ".{$format}" : '');

            return [
                'path' => $path,
                'url' => $res['secure_url'] ?? $res['url'] ?? null,
                'mime_type' => mime_content_type($full) ?: 'application/octet-stream',
                'size' => $res['bytes'] ?? filesize($full),
            ];
        }

        // fallback: move/copy within public disk
        $contents = file_get_contents($full);
        $filename = basename($full);
        $permanent = $folder . '/' . $filename;
        Storage::disk('public')->put($permanent, $contents);

        return [
            'path' => $permanent,
            'url' => Storage::disk('public')->url($permanent),
            'mime_type' => mime_content_type($full) ?: 'application/octet-stream',
            'size' => filesize($full),
        ];
    }

    public function deleteByPath(string $path): void
    {
        if (str_starts_with($path, 'cloudinary://') && $this->useCloudinary) {
            $this->ensureCloudinary();
            if ($this->cloudinary) {
                $rest = substr($path, strlen('cloudinary://'));
                [$resource, $publicAndMaybeExt] = explode('/', $rest, 2) + [1 => ''];
                $publicId = preg_replace('/\.[^.]+$/', '', $publicAndMaybeExt);
                $this->cloudinary->destroy($publicId, $resource);
                return;
            }
            // If cloudinary isn't available, fall through and delete from disks
            // below — nothing to do for remote-only resources.
        }

        // assume public disk path
        // delete both from public and local to be safe
        Storage::disk('public')->delete($path);
        Storage::disk('local')->delete($path);
    }

    /**
     * Get a public URL for a stored path by building it directly.
     * Skips the slow Cloudinary Admin API entirely.
     *
     * @param string $path
     * @return string|null
     */
    public function getPublicUrl(string $path): ?string
    {
        if (str_starts_with($path, 'cloudinary://') && $this->useCloudinary) {
            // Strip the scheme: 'raw/request-files/abc123.pdf'
            $rest = substr($path, strlen('cloudinary://'));

            // $resource = 'raw', $publicAndMaybeExt = 'request-files/abc123.pdf'
            [$resource, $publicAndMaybeExt] = explode('/', $rest, 2) + [1 => ''];

            // If the stored resource type looks like 'image' but the public
            // id includes a non-image extension (e.g. .pdf), prefer the
            // 'raw' delivery resource. This avoids building an image URL
            // for PDFs which can result in 401/invalid responses.
            $ext = strtolower(pathinfo($publicAndMaybeExt, PATHINFO_EXTENSION) ?: '');
            $rawExts = ['pdf','doc','docx','xls','xlsx','ppt','pptx','zip','mp3','mp4','mov','avi','mkv','txt'];
            if ($resource === 'image' && in_array($ext, $rawExts, true)) {
                $resource = 'raw';
            }

            $cloudUrl = env('CLOUDINARY_URL');
            if ($cloudUrl) {
                $parts = parse_url($cloudUrl);
                $cloud = $parts['host'] ?? null;

                if ($cloud) {
                    // Direct Cloudinary delivery URL format
                    return "https://res.cloudinary.com/{$cloud}/{$resource}/upload/{$publicAndMaybeExt}";
                }
            }
            return null;
        }

        // fallback to local/public disk URL
        return Storage::disk('public')->url($path);
    }

    private function extractPublicIdFromUrl(string $url): ?string
    {
        $parts = parse_url($url);
        $path = $parts['path'] ?? '';
        $pos = strpos($path, '/upload/');
        if ($pos === false) return null;
        $after = substr($path, $pos + strlen('/upload/'));
        // strip version prefix v12345/
        $after = preg_replace('/^v\d+\//', '', $after);
        $after = ltrim($after, '/');
        $public = preg_replace('/\.[^.]+$/', '', $after);
        return $public ?: null;
    }
}
