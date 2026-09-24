<?php

namespace Tests\Unit;

use App\Http\Controllers\DepartmentController;
use PHPUnit\Framework\TestCase;

/**
 * The CSV imports post a sheet's rows as it has them, and the server reads
 * each column by the names it goes by. Each fixture holds one sheet as the new
 * page posts it and the same sheet as the page it replaced read it in the
 * browser (both captured from the two clients by e2e-local's page parity run),
 * so the server's reading is checked against what the old page actually did.
 */
class ImportSheetsAreReadAsTheOldPagesReadThemTest extends TestCase
{
    /** @return array<string, callable(array): array> */
    private function readers(): array
    {
        return [
            'department-officers' => fn (array $rows) => DepartmentController::officerRows($rows),
        ];
    }

    public function test_each_sheet_is_read_as_the_old_page_read_it(): void
    {
        $fixtures = glob(__DIR__ . '/../fixtures/import-maps/*.json');
        $this->assertNotEmpty($fixtures);

        foreach ($fixtures as $path) {
            $name = basename($path, '.json');
            $fixture = json_decode(file_get_contents($path), true);
            $read = $this->readers()[$name] ?? $this->fail("No reader for {$name}");

            // Each row's columns in one order: the order a page built its
            // object in carries no meaning.
            $sorted = fn (array $rows) => array_map(function (array $row) {
                ksort($row);
                return $row;
            }, $rows);
            $this->assertSame($sorted($fixture['read']), $sorted($read($fixture['sheet'])), $name);
        }
    }
}
