<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class EnsureExpireRequestsToken
{
    public function handle(Request $request, Closure $next): Response|JsonResponse
    {
        $token = config('services.expire_requests.token');

        if (blank($token)) {
            return response()->json([
                'message' => 'Expiration endpoint is not configured on this server.',
            ], 503);
        }

        $provided = $request->header('X-Expire-Requests-Token');

        if (! hash_equals((string) $token, (string) $provided)) {
            return response()->json([
                'message' => 'Unauthorized.',
            ], 401);
        }

        return $next($request);
    }
}
