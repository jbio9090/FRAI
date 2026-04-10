<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class OllamaController extends Controller
{
    public function proxy(Request $request)
    {
        $payload = $request->all();

        // Force non-streaming response so we can proxy reliably
        $payload['stream'] = false;

        try {
            $resp = Http::post('http://localhost:11434/api/chat', $payload);

            $body = $resp->body();
            $status = $resp->status();
            $contentType = $resp->header('Content-Type', 'application/json');

            // Try to decode JSON and return a normalized structure
            $decoded = json_decode($body, true);

            if (is_array($decoded) && isset($decoded['message']['content'])) {
                return response()->json(['message' => ['content' => $decoded['message']['content']]], $status);
            }

            // Fallback: return the raw body as message content
            return response()->json(['message' => ['content' => $body]], $status)
                ->header('Content-Type', 'application/json');
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
