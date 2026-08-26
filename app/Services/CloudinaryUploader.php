<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;

class CloudinaryUploader
{
    protected string $apiKey;

    protected string $apiSecret;

    protected string $cloudName;

    protected string $uploadUrl;

    public function __construct()
    {
        $url = env('CLOUDINARY_URL');
        if (! $url) {
            throw new \RuntimeException('CLOUDINARY_URL is not configured');
        }

        $parts = parse_url($url);
        $this->apiKey = $parts['user'] ?? '';
        $this->apiSecret = $parts['pass'] ?? '';
        $this->cloudName = $parts['host'] ?? '';
        $this->uploadUrl = "https://api.cloudinary.com/v1_1/{$this->cloudName}/auto/upload";
    }

    /**
     * Upload a local file path or UploadedFile to Cloudinary.
     * Returns decoded response array on success.
     */
    public function uploadFile(string|UploadedFile $file, ?string $folder = null): array
    {
        if ($file instanceof UploadedFile) {
            $filePath = $file->getPathname();
            $mime = $file->getClientMimeType() ?? mime_content_type($filePath);
            $originalName = $file->getClientOriginalName();
        } else {
            $filePath = $file;
            $mime = mime_content_type($filePath) ?: 'application/octet-stream';
            $originalName = basename($filePath);
        }

        $timestamp = time();
        $params = ['timestamp' => $timestamp];
        if ($folder) {
            $params['folder'] = $folder;
        }

        ksort($params);
        $toSign = [];
        foreach ($params as $k => $v) {
            $toSign[] = "{$k}={$v}";
        }

        $signature = sha1(implode('&', $toSign).$this->apiSecret);

        $post = $params + [
            'api_key' => $this->apiKey,
            'signature' => $signature,
        ];

        $ch = curl_init();
        $cfile = curl_file_create($filePath, $mime, $originalName);
        $post['file'] = $cfile;

        curl_setopt($ch, CURLOPT_URL, $this->uploadUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 30);
        curl_setopt($ch, CURLOPT_TIMEOUT, 180);

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err) {
            throw new \RuntimeException('Cloudinary upload failed: '.$err);
        }

        $decoded = json_decode($result, true) ?: [];
        if ($httpCode >= 400) {
            $message = $decoded['error']['message'] ?? $result;
            throw new \RuntimeException('Cloudinary upload error: '.$message);
        }

        return $decoded;
    }

    /**
     * Destroy a resource by public_id and resource type (image/raw/video).
     */
    public function destroy(string $publicId, string $resourceType = 'image'): array
    {
        $url = "https://api.cloudinary.com/v1_1/{$this->cloudName}/{$resourceType}/destroy";
        $timestamp = time();

        $params = [
            'public_id' => $publicId,
            'timestamp' => $timestamp,
        ];

        ksort($params);
        $toSign = [];
        foreach ($params as $k => $v) {
            $toSign[] = "{$k}={$v}";
        }

        $signature = sha1(implode('&', $toSign).$this->apiSecret);

        $post = $params + [
            'api_key' => $this->apiKey,
            'signature' => $signature,
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 30);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err) {
            throw new \RuntimeException('Cloudinary destroy failed: '.$err);
        }

        $decoded = json_decode($result, true) ?: [];
        if ($httpCode >= 400) {
            $message = $decoded['error']['message'] ?? $result;
            throw new \RuntimeException('Cloudinary destroy error: '.$message);
        }

        return $decoded;
    }

    /**
     * Fetch resource details from Cloudinary Admin API for a given public id.
     * Returns decoded resource array (includes secure_url, bytes, format, etc).
     */
    public function resource(string $publicId, string $resourceType = 'image'): array
    {
        $encoded = rawurlencode($publicId);
        $url = "https://api.cloudinary.com/v1_1/{$this->cloudName}/resources/{$resourceType}/upload/{$encoded}";

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_USERPWD, "{$this->apiKey}:{$this->apiSecret}");
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 30);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err) {
            throw new \RuntimeException('Cloudinary resource lookup failed: '.$err);
        }

        $decoded = json_decode($result, true) ?: [];
        if ($httpCode >= 400) {
            $message = $decoded['error']['message'] ?? $result;
            throw new \RuntimeException('Cloudinary resource error: '.$message);
        }

        return $decoded;
    }
}
