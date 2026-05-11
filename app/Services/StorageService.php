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
        if ($this->useCloudinary) {
            try {
                $this->cloudinary = new CloudinaryUploader();
            } catch (\Throwable $e) {
                $this->useCloudinary = false;
                $this->cloudinary = null;
            }
        }
    }

    public function uploadProfileFromUploadedFile(UploadedFile $file): string
    {
        if ($this->useCloudinary && $this->cloudinary) {
            $res = $this->cloudinary->uploadFile($file, 'profiles');
            return $res['secure_url'] ?? $res['url'] ?? '';
        }

        $path = $file->store('profiles', 'public');
        return basename($path);
    }

    public function uploadProfileFromPath(string $localPath): string
    {
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
        if (str_starts_with($path, 'cloudinary://') && $this->useCloudinary && $this->cloudinary) {
            $rest = substr($path, strlen('cloudinary://'));
            [$resource, $publicAndMaybeExt] = explode('/', $rest, 2) + [1 => ''];
            $publicId = preg_replace('/\.[^.]+$/', '', $publicAndMaybeExt);
            $this->cloudinary->destroy($publicId, $resource);
            return;
        }

        // assume public disk path
        // delete both from public and local to be safe
        Storage::disk('public')->delete($path);
        Storage::disk('local')->delete($path);
    }

    /**
     * Get a public URL for a stored path. For Cloudinary paths this will call the
     * Cloudinary Admin API to retrieve the canonical `secure_url` (which includes
     * the version) so the frontend can reliably fetch the resource.
     *
     * @param string $path
     * @return string|null
     */
    public function getPublicUrl(string $path): ?string
    {
        if (str_starts_with($path, 'cloudinary://') && $this->useCloudinary && $this->cloudinary) {
            $rest = substr($path, strlen('cloudinary://'));
            [$resource, $publicAndMaybeExt] = explode('/', $rest, 2) + [1 => ''];
            $publicId = preg_replace('/\.[^.]+$/', '', $publicAndMaybeExt);

            try {
                $res = $this->cloudinary->resource($publicId, $resource);
                return $res['secure_url'] ?? $res['url'] ?? null;
            } catch (\Throwable $e) {
                // fallback: try to reconstruct a plausible URL (may miss version)
                $cloudUrl = env('CLOUDINARY_URL');
                if ($cloudUrl) {
                    $parts = parse_url($cloudUrl);
                    $cloud = $parts['host'] ?? null;
                    if ($cloud) {
                        $format = null;
                        if (preg_match('/\.([a-z0-9]+)$/i', $publicAndMaybeExt, $m)) {
                            $format = $m[1];
                        }
                        $url = "https://res.cloudinary.com/{$cloud}/{$resource}/upload/{$publicId}";
                        if ($format) {
                            $url .= '.' . $format;
                        }
                        return $url;
                    }
                }
                return null;
            }
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
