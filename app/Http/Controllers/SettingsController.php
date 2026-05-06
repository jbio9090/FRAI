<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver;

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

        $filename = $user->id . '_' . time() . '.webp';

        $manager = ImageManager::usingDriver(Driver::class);

        $image = $manager->decode($request->file('profile')->getRealPath())
            ->scale(width: 800, height: 800)
            ->encodeUsingFileExtension('webp', quality:70);

        Storage::disk('public')->put('profiles/' . $filename, $image);

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

    public function updateAdminEmailNotifications(Request $request)
    {
        $validated = $request->validate([
            'subscribed' => ['required', 'boolean'],
        ]);

        $request->user()->forceFill([
            'admin_email_notifications_enabled' => $validated['subscribed'],
        ])->save();

        return back()->with(
            'success',
            $validated['subscribed']
                ? 'Email notifications enabled.'
                : 'Email notifications disabled.'
        );
    }

    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password'      => ['required'],
            'password'              => ['required', 'min:8', 'confirmed', 'different:current_password'],
            'password_confirmation' => ['required'],
        ]);

        $user = Auth::user();

        if (!Hash::check($request->current_password, $user->password)) {
            return back()->withErrors(['current_password' => 'The current password is incorrect.']);
        }

        $user->update([
            'password' => Hash::make($request->password),
        ]);

        // Log out all other sessions
        Auth::logoutOtherDevices($request->password);

        return back()->with('success', 'Password changed successfully.');
    }
}
