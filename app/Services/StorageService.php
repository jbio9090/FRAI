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
            $this->cloudinary = new CloudinaryUploader;
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
        Storage::disk('public')->put('profiles/'.$filename, $contents);

        return $filename;
    }

    /**
     * Upload a request/file attachment from an UploadedFile and return metadata array.
     *
     * For Cloudinary uploads the canonical 'path' is the secure_url returned by the
     * API so that URL construction never needs to be re-done from constituent parts.
     * 'public_id' and 'resource_type' are also returned so callers can persist them
     * for future deletion without parsing the URL.
     */
    public function uploadRequestFileFromUploadedFile(UploadedFile $file, string $folder = 'request-files'): array
    {
        $this->ensureCloudinary();
        if ($this->useCloudinary && $this->cloudinary) {
            $res = $this->cloudinary->uploadFile($file, $folder);
            $secureUrl = $res['secure_url'] ?? $res['url'] ?? null;

            return [
                // Store the canonical delivery URL directly — no manual reconstruction needed.
                'path' => $secureUrl,
                'url' => $secureUrl,
                'public_id' => $res['public_id'] ?? null,
                'resource_type' => $res['resource_type'] ?? 'raw',
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
     * Upload a request file from an existing local storage path (relative to storage/app/public).
     *
     * For Cloudinary uploads the canonical 'path' is the secure_url returned by the API.
     * 'public_id' and 'resource_type' are also returned for future deletion support.
     */
    public function uploadRequestFileFromLocalPath(string $relativePath, string $folder = 'request-files'): array
    {
        $full = storage_path('app/public/'.ltrim($relativePath, '/'));
        if (! file_exists($full)) {
            throw new \RuntimeException("Local file not found: {$full}");
        }

        $this->ensureCloudinary();
        if ($this->useCloudinary && $this->cloudinary) {
            $res = $this->cloudinary->uploadFile($full, $folder);
            $secureUrl = $res['secure_url'] ?? $res['url'] ?? null;

            return [
                // Store the canonical delivery URL directly — no manual reconstruction needed.
                'path' => $secureUrl,
                'url' => $secureUrl,
                'public_id' => $res['public_id'] ?? null,
                'resource_type' => $res['resource_type'] ?? 'raw',
                'mime_type' => mime_content_type($full) ?: 'application/octet-stream',
                'size' => $res['bytes'] ?? filesize($full),
            ];
        }

        // fallback: move/copy within public disk
        $contents = file_get_contents($full);
        $filename = basename($full);
        $permanent = $folder.'/'.$filename;
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
        // New format: path IS the Cloudinary delivery URL (https://res.cloudinary.com/...).
        // Extract resource type and public_id directly from the URL segments.
        if (str_starts_with($path, 'https://res.cloudinary.com/') && $this->useCloudinary) {
            $this->ensureCloudinary();
            if ($this->cloudinary) {
                $publicId = $this->extractPublicIdFromUrl($path);
                // Determine resource type from URL: .../image/upload/... vs .../raw/upload/...
                $resource = 'image';
                if (preg_match('#/([^/]+)/upload/#', $path, $m)) {
                    $resource = $m[1]; // 'image', 'raw', 'video', etc.
                }
                if ($publicId) {
                    $this->cloudinary->destroy($publicId, $resource);
                }

                return;
            }
        }

        // Legacy format: cloudinary://{resource}/{publicId.ext}
        if (str_starts_with($path, 'cloudinary://') && $this->useCloudinary) {
            $this->ensureCloudinary();
            if ($this->cloudinary) {
                $rest = substr($path, strlen('cloudinary://'));
                [$resource, $publicAndMaybeExt] = explode('/', $rest, 2) + [1 => ''];
                $publicId = preg_replace('/\.[^.]+$/', '', $publicAndMaybeExt);
                $this->cloudinary->destroy($publicId, $resource);

                return;
            }

            // If cloudinary isn't available, nothing to do for remote-only resources.
            return;
        }

        // Local disk path
        Storage::disk('public')->delete($path);
        Storage::disk('local')->delete($path);
    }

    /**
     * Get a public URL for a stored path.
     *
     * New uploads store the Cloudinary secure_url directly as the path, so this
     * method just returns it as-is.  Older uploads used the 'cloudinary://' scheme;
     * those are handled by reconstructing a delivery URL (best-effort, kept for
     * backward compatibility).  Local-disk paths go through Storage::disk('public').
     */
    public function getPublicUrl(string $path): ?string
    {
        // New format: path is already a fully-qualified Cloudinary delivery URL.
        if (str_starts_with($path, 'https://')) {
            return $path;
        }

        // Legacy format: cloudinary://{resource}/{publicId.ext}
        // Reconstruct the delivery URL as a best-effort fallback for existing rows.
        if (str_starts_with($path, 'cloudinary://') && $this->useCloudinary) {
            $rest = substr($path, strlen('cloudinary://'));
            [$resource, $publicAndMaybeExt] = explode('/', $rest, 2) + [1 => ''];

            // Promote image→raw when the public-id has a non-image extension so
            // Cloudinary serves the file via the correct delivery pipeline.
            $ext = strtolower(pathinfo($publicAndMaybeExt, PATHINFO_EXTENSION) ?: '');
            $rawExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'mp3', 'mp4', 'mov', 'avi', 'mkv', 'txt'];
            if ($resource === 'image' && in_array($ext, $rawExts, true)) {
                $resource = 'raw';
            }

            $cloudUrl = env('CLOUDINARY_URL');
            if ($cloudUrl) {
                $parts = parse_url($cloudUrl);
                $cloud = $parts['host'] ?? null;
                if ($cloud) {
                    return "https://res.cloudinary.com/{$cloud}/{$resource}/upload/{$publicAndMaybeExt}";
                }
            }

            return null;
        }

        // Local / public-disk path
        return Storage::disk('public')->url($path);
    }

    private function extractPublicIdFromUrl(string $url): ?string
    {
        $parts = parse_url($url);
        $path = $parts['path'] ?? '';
        $pos = strpos($path, '/upload/');
        if ($pos === false) {
            return null;
        }
        $after = substr($path, $pos + strlen('/upload/'));
        // strip version prefix v12345/
        $after = preg_replace('/^v\d+\//', '', $after);
        $after = ltrim($after, '/');
        $public = preg_replace('/\.[^.]+$/', '', $after);

        return $public ?: null;
    }
}
