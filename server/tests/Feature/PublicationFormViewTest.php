<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Pages\PublicationFormPage;
use Tests\TestCase;

/** The publication form each reader is asked to fill. */
class PublicationFormViewTest extends TestCase
{
    private function labels(string $role, string $kind, array $params = []): array
    {
        $user = new User();
        $user->setRelation('current_role', new Role(['role' => $role]));
        $rows = (new PublicationFormPage())->view($user, $params)['forms'][$kind];

        return array_merge(...array_map(fn ($row) => array_column($row['items'] ?? [], 'label'), $rows));
    }

    public function test_a_scholar_is_asked_the_status_and_first_page(): void
    {
        $this->assertSame(
            ['DOI Link', 'Author(s)', 'Year of Publication/Acceptance', 'Title of the Paper', 'Name of Journal', 'Volume', 'Page Number', 'Status of Paper:', 'Impact Factor', 'Upload First Page', 'Submit'],
            $this->labels('student', 'journal'),
        );
    }

    public function test_a_faculty_record_keeps_neither(): void
    {
        $labels = $this->labels('faculty', 'conference', ['faculty' => 1]);
        $this->assertNotContains('Status of Paper:', $labels);
        $this->assertNotContains('Upload First Page', $labels);
    }

    /** @return array<int, array<string, mixed>> */
    private function fields(string $role, string $kind): array
    {
        $user = new User();
        $user->setRelation('current_role', new Role(['role' => $role]));
        $rows = (new PublicationFormPage())->view($user, [])['forms'][$kind];

        return array_merge(...array_map(fn ($row) => $row['items'] ?? [], $rows));
    }

    public function test_the_doi_box_is_asked_first_and_fills_only_the_fields_its_kind_has(): void
    {
        foreach (['journal', 'book', 'conference'] as $kind) {
            $fields = $this->fields('student', $kind);
            $this->assertSame('suggest', $fields[0]['type'], "the {$kind} form asks the DOI first");

            $asked = array_column($fields, 'key');
            foreach (array_keys($fields[0]['picks']) as $filled) {
                $this->assertContains($filled, $asked, "the {$kind} form fills {$filled} but never asks it");
            }
        }
    }

    public function test_a_patent_gets_a_plain_doi_box(): void
    {
        $first = $this->fields('student', 'patents')[0];
        $this->assertSame('DOI Link', $first['label']);
        $this->assertSame('text', $first['type']);
    }

    public function test_a_ug_student_is_asked_the_conference_mode_and_funding(): void
    {
        $this->assertContains('Mode of Conference', $this->labels('ug_student', 'conference'));
        $this->assertNotContains('Mode of Conference', $this->labels('student', 'conference'));
    }
}
