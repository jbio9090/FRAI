<?php

$baseDir = __DIR__;
$publicDir = $baseDir.'/public';
$storageDir = $baseDir.'/storage/app/public';
$symlinkPath = $publicDir.'/storage';

echo "Storage Symlink Setup Tool\n";
echo "==========================\n\n";

if (is_dir($symlinkPath)) {
    echo "✓ Storage symlink already exists at {$symlinkPath}\n";
    exit(0);
}

if (! is_dir($storageDir)) {
    echo "✗ Storage directory not found at {$storageDir}\n";
    exit(1);
}

echo "Creating symlink...\n";
echo "  From: {$publicDir}/storage\n";
echo "  To:   {$storageDir}\n\n";

$isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';

if ($isWindows) {
    echo "Windows detected - using mklink command\n";

    $cmd = sprintf(
        'mklink /D "%s" "%s"',
        $symlinkPath,
        $storageDir
    );

    echo "Executing: {$cmd}\n\n";

    $output = [];
    $returnCode = 0;
    exec($cmd.' 2>&1', $output, $returnCode);

    foreach ($output as $line) {
        echo "  {$line}\n";
    }

    if ($returnCode === 0) {
        echo "\n✓ Symlink created successfully\n";

        if (is_link($symlinkPath) || is_dir($symlinkPath)) {
            echo "✓ Symlink verified\n";
            echo "\nFiles will now be accessible at: /storage/{filename}\n";
            exit(0);
        }
    } else {
        echo "\n✗ Failed to create symlink (return code: {$returnCode})\n";
        echo "\nTROUBLESHOOTING:\n";
        echo "1. Run this script as Administrator\n";
        echo "2. Or run: mklink /D public\\storage storage\\app\\public\n";
        echo "3. Or run: php artisan storage:link\n";
        exit(1);
    }
} else {
    echo "Unix-like system detected - using symlink()\n";

    if (@symlink($storageDir, $symlinkPath)) {
        echo "✓ Symlink created successfully\n";
        exit(0);
    } else {
        echo "✗ Failed to create symlink\n";
        exit(1);
    }
}
