<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class SettingsController extends Controller
{
    public function index()
    {
        return Inertia::render("settings/index");
    }

    public function updateProfilePicture(Request $request)
    {
        $request->validate([
            'profile' => ['required', 'image', 'max:2048'],
        ]);

        $user = Auth::user();

        if ($user->profile !== 'default.png') {
            Storage::disk('public')->delete('profiles/' . $user->profile);
        }

        $filename = $user->id . '_' . time() . '.' . $request->file('profile')->extension();
        $request->file('profile')->storeAs('profiles', $filename, 'public');

        $user->update(['profile' => $filename]);

        return back()->with('success', 'Profile picture updated.');
    }

    public function removeProfilePicture()
    {
        $user = Auth::user();

        if ($user->profile !== 'default.png') {
            Storage::disk('public')->delete('profiles/' . $user->profile);
            $user->update(['profile' => 'default.png']);
        }

        return back()->with('success', 'Profile picture removed.');
    }
}
