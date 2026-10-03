<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Guards the persistent-layout wiring in resources/js/layout.tsx/page-shell.tsx.
 *
 * The failure mode this protects against is silent and visual: a page that wraps
 * itself in <DefaultLayout> renders a second, per-visit shell nested inside the
 * persistent one, so the sidebar/chatbot/toasts stop persisting and the page
 * gains a duplicate set of page padding. Nothing fails at build time, so these
 * are asserted against the source instead.
 */
class PersistentLayoutTest extends TestCase
{
    private function basePath(string $relative): string
    {
        return base_path($relative);
    }

    private function pageFiles(): array
    {
        $files = glob($this->basePath('resources/js/pages').'/*.tsx');
        $nested = glob($this->basePath('resources/js/pages').'/*/*.tsx');

        $pages = array_merge($files ?: [], $nested ?: []);

        sort($pages);

        return $pages;
    }

    private function pageShellSource(): string
    {
        return (string) file_get_contents($this->basePath('resources/js/layout.tsx/page-shell.tsx'));
    }

    /**
     * @return array<int, string>
     */
    private function pageNamesInSet(string $constant): array
    {
        $matched = preg_match(
            '/const\s+'.$constant.'\s*=\s*new Set\(\[(.*?)\]\)/s',
            $this->pageShellSource(),
            $matches
        );

        $this->assertSame(1, $matched, "Could not read {$constant} out of page-shell.tsx.");

        preg_match_all("/'([^']+)'/", $matches[1], $names);

        return $names[1];
    }

    public function test_no_page_wraps_itself_in_the_app_shell(): void
    {
        $offenders = [];
        $pagesRoot = str_replace('\\', '/', $this->basePath('resources/js/pages')).'/';

        foreach ($this->pageFiles() as $file) {
            if (str_contains((string) file_get_contents($file), 'DefaultLayout')) {
                $normalized = str_replace('\\', '/', $file);
                $offenders[] = str_starts_with($normalized, $pagesRoot)
                    ? substr($normalized, strlen($pagesRoot))
                    : $normalized;
            }
        }

        $this->assertSame(
            [],
            $offenders,
            'These pages render <DefaultLayout> themselves. The shell is attached by '
            .'applyPageShell() as a persistent layout, so a page-level wrapper nests a '
            .'second per-visit shell. Drop the wrapper and, if the page needs '
            .'hasPadding={false}, add its name to EDGE_TO_EDGE_PAGES instead.'
        );
    }

    public function test_both_inertia_entry_points_apply_the_page_shell(): void
    {
        // ssr.tsx is the SSR entry (see package.json build:node). Even though the
        // shipped containers only run `npm run build` and Inertia therefore falls
        // back to CSR, ssr.tsx must stay in sync — an ssr.tsx that skipped
        // applyPageShell() would emit an unshelled shell for any deployment that
        // does serve SSR.
        foreach (['resources/js/app.tsx', 'resources/js/ssr.tsx'] as $entryPoint) {
            $source = (string) file_get_contents($this->basePath($entryPoint));

            $this->assertStringContainsString(
                'applyPageShell',
                $source,
                "{$entryPoint} must call applyPageShell() so the resolved page carries the persistent layout."
            );
        }
    }

    public function test_pages_listed_in_the_shell_still_exist(): void
    {
        foreach (['UNSHELLED_PAGES', 'EDGE_TO_EDGE_PAGES'] as $constant) {
            foreach ($this->pageNamesInSet($constant) as $name) {
                $exists = is_file($this->basePath("resources/js/pages/{$name}.tsx"))
                    || is_file($this->basePath("resources/js/pages/{$name}/index.tsx"));

                $this->assertTrue(
                    $exists,
                    "{$constant} references '{$name}' but resources/js/pages/{$name}.tsx does not exist. "
                    .'A renamed page silently falls through to the padded default shell.'
                );
            }
        }
    }

    public function test_shell_lists_are_disjoint(): void
    {
        $overlap = array_intersect(
            $this->pageNamesInSet('UNSHELLED_PAGES'),
            $this->pageNamesInSet('EDGE_TO_EDGE_PAGES')
        );

        $this->assertSame([], array_values($overlap), 'A page cannot be both unshelled and edge-to-edge.');
    }
}
