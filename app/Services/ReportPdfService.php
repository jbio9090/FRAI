<?php

namespace App\Services;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\Process\Process;

class ReportPdfService
{
    /**
     * Common LibreOffice binary locations across platforms.
     *
     * @var array<int, string>
     */
    private const BINARIES = [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
        '/usr/lib/libreoffice/program/soffice',
        '/usr/bin/soffice',
        '/usr/bin/libreoffice',
        '/usr/bin/lowriter',
        '/Applications/LibreOffice.app/Contents/MacOS/soffice',
        '/opt/homebrew/bin/soffice',
        '/usr/local/bin/soffice',
    ];

    public function __construct(protected ReportDocxService $reportDocxService) {}

    /**
     * Fill the DOCX template and convert the resulting document to PDF.
     */
    public function generate(int $year, int $month): string
    {
        $docx = $this->reportDocxService->generate($year, $month);

        try {
            return $this->convert($docx);
        } finally {
            File::delete($docx);
        }
    }

    /**
     * Whether a usable LibreOffice binary can be found.
     */
    public function isAvailable(): bool
    {
        return $this->resolveBinary() !== null;
    }

    private function convert(string $docx): string
    {
        $binary = $this->resolveBinary();

        if ($binary === null) {
            throw new RuntimeException(
                'Unable to export the report as PDF because LibreOffice was not found. '
                .'Install LibreOffice or set the LIBREOFFICE_BINARY environment variable.'
            );
        }

        $directory = storage_path('app/tmp');
        File::ensureDirectoryExists($directory);

        $workspace = $directory.'/'.Str::random(24);
        $profile = $workspace.'/profile';
        File::ensureDirectoryExists($profile);

        try {
            $source = $workspace.'/'.basename($docx);
            File::copy($docx, $source);

            $process = new Process([
                $binary,
                '--headless',
                '--norestore',
                '--invisible',
                '--nodefault',
                '--nolockcheck',
                '--convert-to',
                'pdf',
                '--outdir',
                $workspace,
                '-env:UserInstallation='.$this->fileUrl($profile),
                $source,
            ]);

            $process->setTimeout(180);
            $process->run();

            if (! $process->isSuccessful()) {
                throw new RuntimeException(
                    'Unable to convert the report to PDF: '.$this->errorMessage($process)
                );
            }

            $converted = $workspace.'/'.pathinfo($source, PATHINFO_FILENAME).'.pdf';

            if (! File::exists($converted)) {
                throw new RuntimeException(
                    'The PDF converter finished without producing a file. '.$this->errorMessage($process)
                );
            }

            $path = $directory.'/'.Str::lower(Str::random(24)).'.pdf';
            File::move($converted, $path);

            return $path;
        } finally {
            File::deleteDirectory($workspace);
        }
    }

    /**
     * Resolve the LibreOffice binary from config or well-known locations.
     */
    private function resolveBinary(): ?string
    {
        $configured = config('reports.libreoffice_binary');

        if (is_string($configured) && trim($configured) !== '') {
            return trim($configured);
        }

        foreach (self::BINARIES as $candidate) {
            if (File::exists($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * Convert a filesystem path into a file:// URL for LibreOffice's profile flag.
     */
    private function fileUrl(string $path): string
    {
        $path = str_replace('\\', '/', $path);

        if (preg_match('/^[A-Za-z]:\//', $path) === 1) {
            return 'file:///'.$path;
        }

        return 'file://'.(str_starts_with($path, '/') ? $path : '/'.$path);
    }

    private function errorMessage(Process $process): string
    {
        $output = trim($process->getErrorOutput());

        if ($output === '') {
            $output = trim($process->getOutput());
        }

        return $output === '' ? 'Unknown LibreOffice error.' : $output;
    }
}
