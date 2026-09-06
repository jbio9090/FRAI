<?php

namespace App\Http\Controllers;

use App\Models\RequestFile;
use App\Services\CloudinaryUploader;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class FileController extends Controller
{
    public function stream(RequestFile $file)
    {
        // Simple ownership + admin check — no Gate policy required.
        $user = auth()->user();
        $isOwner = $file->request->user_id === $user->id;
        $isAdmin = $user->hasRole(['admin', 'Super Admin']);
        abort_if(! $isOwner && ! $isAdmin, 403);
        // Developer-friendly debug output when ?debug_cloud=1 is present.
        $debug = request()->boolean('debug_cloud');
        $resolvedUrl = $this->resolveCloudinaryUrl($file);

        if ($debug && ($isAdmin || app()->isLocal())) {
            $info = ['resolvedUrl' => $resolvedUrl, 'head' => null, 'admin' => null, 'attempts' => []];
            try {
                $head = Http::timeout(10)->head($resolvedUrl);
                $info['head'] = ['status' => $head->status(), 'ok' => $head->ok()];
            } catch (\Throwable $e) {
                $info['head'] = ['error' => $e->getMessage()];
            }

            if (str_starts_with($file->path, 'cloudinary://')) {
                try {
                    $rest = substr($file->path, strlen('cloudinary://'));
                    [$resource, $publicAndExt] = explode('/', $rest, 2) + [1 => ''];
                    $ext = strtolower(pathinfo($publicAndExt, PATHINFO_EXTENSION) ?: '');
                    $rawExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'mp3', 'mp4', 'mov', 'avi', 'mkv', 'txt'];
                    if ($resource === 'image' && in_array($ext, $rawExts, true)) {
                        $resource = 'raw';
                    }
                    $publicId = preg_replace('/\.[^.]+$/', '', $publicAndExt);

                    $uploader = new CloudinaryUploader;
                    $meta = $uploader->resource($publicId, $resource);
                    $info['admin'] = $meta;

                    $secure = $meta['secure_url'] ?? $meta['url'] ?? null;
                    if ($secure) {
                        try {
                            $head2 = Http::timeout(10)->head($secure);
                            $info['attempts'][] = ['secure' => $secure, 'head' => ['status' => $head2->status(), 'ok' => $head2->ok()]];
                        } catch (\Throwable $e) {
                            $info['attempts'][] = ['secure' => $secure, 'error' => $e->getMessage()];
                        }
                    }
                } catch (\Throwable $e) {
                    $info['admin_error'] = $e->getMessage();
                }
            }

            return response()->json($info);
        }

        // If we can build a direct URL (Cloudinary or local public URL),
        // redirect the client directly to that URL instead of proxying
        // the bytes through the app. This avoids Admin API calls and the
        // need for a configured `cloudinary` storage disk.
        if ($resolvedUrl) {
            // For new-format uploads the path IS the Cloudinary secure_url, so
            // skip the HEAD check — the URL is authoritative and a superfluous
            // HEAD round-trip to Cloudinary just adds latency.
            if (str_starts_with($file->path, 'https://')) {
                return redirect()->away($resolvedUrl);
            }

            // Perform a lightweight HEAD to verify the URL is publicly accessible.
            try {
                $head = Http::timeout(10)->head($resolvedUrl);
            } catch (\Throwable $e) {
                $head = null;
            }

            if ($head && $head->successful()) {
                return redirect()->away($resolvedUrl);
            }

            // If the HEAD failed (401/private resource or other error), only
            // then instantiate the Cloudinary Admin client and attempt a
            // server-side fetch of the resource. This keeps Admin API calls
            // lazy (not on every page load).
            if (str_starts_with($file->path, 'cloudinary://')) {
                try {
                    $rest = substr($file->path, strlen('cloudinary://'));
                    [$resource, $publicAndExt] = explode('/', $rest, 2) + [1 => ''];

                    // If the filename extension is a non-image type, prefer
                    // using the `raw` resource type when querying Admin API.
                    $ext = strtolower(pathinfo($publicAndExt, PATHINFO_EXTENSION) ?: '');
                    $rawExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'mp3', 'mp4', 'mov', 'avi', 'mkv', 'txt'];
                    if ($resource === 'image' && in_array($ext, $rawExts, true)) {
                        $resource = 'raw';
                    }

                    $publicId = preg_replace('/\.[^.]+$/', '', $publicAndExt);

                    $uploader = new CloudinaryUploader;
                    $meta = $uploader->resource($publicId, $resource);

                    $secure = $meta['secure_url'] ?? $meta['url'] ?? null;
                    if ($secure) {
                        // Prefer redirecting the client to the Admin-provided
                        // secure URL (more authoritative than our constructed URL).
                        try {
                            $headSecure = Http::timeout(10)->head($secure);
                        } catch (\Throwable $e) {
                            $headSecure = null;
                        }

                        if ($headSecure && $headSecure->successful()) {
                            return redirect()->away($secure);
                        }

                        // Last resort: attempt to fetch bytes server-side and
                        // stream them to the client.
                        try {
                            $response = Http::timeout(30)->get($secure);
                            if (! $response->failed()) {
                                return response($response->body(), 200, [
                                    'Content-Type' => $file->mime_type,
                                    'Content-Disposition' => 'inline; filename="'.addslashes($file->original_name).'"',
                                    'Cache-Control' => 'private, max-age=3600',
                                    'X-Content-Type-Options' => 'nosniff',
                                ]);
                            }
                        } catch (\Throwable $e) {
                            // fall through
                        }
                    }
                } catch (\Throwable $e) {
                    // fall through to final redirect attempt below
                }
            }

            // If we couldn't proxy the content server-side, still attempt
            // to redirect the client to the constructed URL (it may work
            // for some resources even if HEAD failed).
            return redirect()->away($resolvedUrl);
        }

        // Local disk fallback: attempt to read from public/local disk and
        // stream the file. Do not attempt to use a `cloudinary` disk here.
        try {
            if (Storage::disk('public')->exists($file->path)) {
                $contents = Storage::disk('public')->get($file->path);
            } elseif (Storage::disk('local')->exists($file->path)) {
                $contents = Storage::disk('local')->get($file->path);
            } else {
                abort(404, 'Could not resolve file URL.');
            }

            return response($contents, 200, [
                'Content-Type' => $file->mime_type,
                'Content-Disposition' => 'inline; filename="'.addslashes($file->original_name).'"',
                'Cache-Control' => 'private, max-age=3600',
                'X-Content-Type-Options' => 'nosniff',
            ]);
        } catch (\Throwable $e) {
            abort(502, 'File could not be retrieved from storage: '.$e->getMessage());
        }
    }

    /**
     * Resolve the real Cloudinary URL without going through the model accessor
     * (which would return the proxy route URL, causing infinite recursion).
     */
    private function resolveCloudinaryUrl(RequestFile $file): ?string
    {
        // New format: path is already the canonical Cloudinary delivery URL.
        // Return it directly — do not pass through Storage::disk()->url() which
        // would prepend the local app base URL and corrupt the https:// path.
        if (str_starts_with($file->path, 'https://')) {
            return $file->path;
        }

        // Legacy format: cloudinary://{resource}/{publicId.ext}
        if (str_starts_with($file->path, 'cloudinary://')) {
            try {
                return app(\App\Services\StorageService::class)->getPublicUrl($file->path);
            } catch (\Throwable) {
                // fall through
            }
        }

        // Local disk fallback
        return Storage::disk('public')->url($file->path);
    }

    /**
     * Fallback: try to read the file content directly via Storage disk.
     * Works when the Cloudinary package is configured with the `cloudinary` disk.
     */
    private function streamViaStorage(RequestFile $file)
    {
        try {
            // Only support local/public/local disk streaming here. If the
            // path is a cloudinary:// URL we cannot stream it via the
            // filesystem unless a `cloudinary` disk is configured — instead
            // the controller prefers redirecting to the public URL.
            if (! str_starts_with($file->path, 'cloudinary://')) {
                if (Storage::disk('public')->exists($file->path)) {
                    $contents = Storage::disk('public')->get($file->path);
                } elseif (Storage::disk('local')->exists($file->path)) {
                    $contents = Storage::disk('local')->get($file->path);
                } else {
                    abort(404, 'File not found on disk.');
                }

                return response($contents, 200, [
                    'Content-Type' => $file->mime_type,
                    'Content-Disposition' => 'inline; filename="'.addslashes($file->original_name).'"',
                    'Cache-Control' => 'private, max-age=3600',
                ]);
            }

            abort(502, 'Cloudinary disk not configured or resource inaccessible.');
        } catch (\Throwable $e) {
            abort(502, 'File could not be retrieved from storage: '.$e->getMessage());
        }
    }
}
