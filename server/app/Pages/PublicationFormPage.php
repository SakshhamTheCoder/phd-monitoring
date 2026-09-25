<?php

namespace App\Pages;

use App\Forms\Field;
use App\Forms\ResolvesRows;
use App\Models\User;

/**
 * The form a publication is added or edited with: the kinds offered, and the
 * fields each kind asks for, drawn by the client's server form renderer. A
 * faculty member's own record (params.faculty) keeps no status, conference
 * mode, funding or first page, so those are not asked there; a UG student's
 * conference also asks its mode and funding, as the URF sheet does.
 */
final class PublicationFormPage extends PageDefinition
{
    use ResolvesRows;

    public function allows(User $user): bool
    {
        return true;
    }

    public function view(User $user, array $params = []): array
    {
        $faculty = !empty($params['faculty']);
        $urf = $user->current_role?->role === 'ug_student';

        return self::page('Choose a publication type', null, [
            'choose' => 'Publication Type',
            'kinds' => [
                ['publication_type' => 'journal', 'type' => 'sci', 'label' => 'Papers in SCI/SCIE/SSCI/ABDC/AHCI Journal'],
                ['publication_type' => 'journal', 'type' => 'non-sci', 'label' => 'Papers in Scopus Journal'],
                ['publication_type' => 'book', 'label' => 'Book Chapters'],
                ['publication_type' => 'conference', 'label' => 'Papers in Conference'],
                ['publication_type' => 'patents', 'label' => 'Patents'],
            ],
            // Each field starts empty; a record being edited fills them (`from`).
            'forms' => [
                'journal' => $this->resolveRows(self::journal($faculty), []),
                'book' => $this->resolveRows(self::book($faculty), []),
                'conference' => $this->resolveRows(self::conference($faculty, $urf), []),
                'patents' => $this->resolveRows(self::patents($faculty), []),
            ],
        ]);
    }

    /** A text box starting from the record being edited. */
    private static function text(string $label, string $key, string $hint): Field
    {
        return Field::text($label)->key($key)->hint($hint)->from($key)->open();
    }

    private static function choice(string $label, string $key, array $options): Field
    {
        return Field::select($label, $options)->key($key)->from($key)->open();
    }

    /** The seven years around this one, as the form has always offered. */
    private static function years(string $label): Field
    {
        $year = (int) now()->year;
        return self::choice($label, 'year', array_map(fn ($y) => ['title' => $y, 'value' => $y], range($year - 3, $year + 3)));
    }

    private static function status(string $label, array $options): Field
    {
        return self::choice($label, 'status', $options);
    }

    private static function firstPage(?int $maxMb): Field
    {
        $field = Field::file('Upload First Page')->key('first_page')->from('first_page')->open();
        return $maxMb ? $field->with(['max_mb' => $maxMb]) : $field;
    }

    private static function submit(): array
    {
        return self::row([Field::submit('Submit')->heldWhileSending()->open()]);
    }

    private const PUBLISHED = [['title' => 'Accepted', 'value' => 'accepted'], ['title' => 'Published', 'value' => 'published']];

    private static function journal(bool $faculty): array
    {
        return array_values(array_filter([
            self::row([self::text('Author(s)', 'authors', 'Enter Author(s), separated by commas')]),
            self::row([self::years('Year of Publication/Acceptance')]),
            self::row([self::text('Title of the Paper', 'title', 'Enter Title')], 2),
            self::row([self::text('Name of Journal', 'name', 'Journal Name')], 2),
            self::row(array_values(array_filter([
                self::text('Volume', 'volume', 'Volume'),
                self::text('Page Number', 'page_no', 'Page Number'),
                $faculty ? null : self::status('Status of Paper:', self::PUBLISHED),
            ]))),
            self::row([self::text('Impact Factor', 'impact_factor', 'Impact Factor')]),
            self::row([self::text('DOI Link', 'doi_link', 'DOI Link')]),
            $faculty ? null : self::row([self::firstPage(15)]),
            self::submit(),
        ]));
    }

    private static function book(bool $faculty): array
    {
        return array_values(array_filter([
            self::row([self::text('Author(s)', 'authors', 'Enter Author(s),separated by commas')]),
            self::row([self::text('Name of Book', 'name', 'Book Name')], 2),
            self::row(array_values(array_filter([
                self::years('Year of Publication/Acceptance'),
                $faculty ? null : self::status('Status of Book:', self::PUBLISHED),
            ])), 2),
            self::row([self::text('Chapter Title', 'title', 'Enter Title')], 2),
            self::row([
                self::text('Volume', 'volume', 'Volume'),
                self::text('Page Number', 'page_no', 'Page Number'),
                self::text('ISSN', 'issn', 'ISSN'),
            ]),
            self::row([self::text('Name of Publisher', 'publisher', 'Publisher Name')], 2),
            self::row([self::text('DOI Link', 'doi_link', 'DOI Link')]),
            $faculty ? null : self::row([self::firstPage(15)]),
            self::submit(),
        ]));
    }

    private static function conference(bool $faculty, bool $urf): array
    {
        // A place is searched for; picking one keeps its name and code, and
        // the state and city searches are narrowed by what is picked above them.
        $place = fn (string $label, string $key, string $source, array $picks) => Field::suggest($label, $source)
            ->key($key)->hint($label)->from($key)->displayFrom($key)->picks($picks)->with(['params_from_answers' => true])->open();

        return array_values(array_filter([
            self::row([self::text('Author(s)', 'authors', 'Enter Author(s)')]),
            self::row([self::years('Year of Publication/Acceptance')]),
            self::row([self::text('Title of the Paper', 'title', 'Enter Title')], 2),
            self::row([self::text('Name of Conference', 'name', 'Journal Name')], 2),
            self::row([
                $place('Country', 'country', '/suggestions/country', ['country' => 'name', 'country_code' => 'code']),
                $place('State', 'state', '/suggestions/state', ['state' => 'name', 'state_code' => 'code']),
                $place('City', 'city', '/suggestions/city', ['city' => 'name']),
            ]),
            self::row(array_values(array_filter([
                self::choice('Type of Conference', 'type', [['title' => 'National', 'value' => 'national'], ['title' => 'International', 'value' => 'international']]),
                $faculty ? null : self::status('Status of Paper:', self::PUBLISHED),
            ]))),
            $urf && !$faculty ? self::row([
                self::choice('Mode of Conference', 'mode', [['title' => 'Offline', 'value' => 'offline'], ['title' => 'Online', 'value' => 'online']]),
                self::text('Funding Received', 'funding', 'Funding source, if any'),
            ]) : null,
            self::row([self::text('DOI Link', 'doi_link', 'DOI Link')]),
            $faculty ? null : self::row([self::firstPage(15)]),
            self::submit(),
        ]));
    }

    private static function patents(bool $faculty): array
    {
        return array_values(array_filter([
            self::row([self::text('Author(s)', 'authors', 'Enter Author(s)')]),
            self::row([self::years('Year of Award')]),
            self::row([self::text('Title of the Patent', 'title', 'Enter Title')], 2),
            self::row(array_values(array_filter([
                self::choice('Type of Patent', 'country', [['title' => 'National', 'value' => 'National'], ['title' => 'International', 'value' => 'International']]),
                $faculty ? null : self::status('Status of Patent:', [['title' => 'Granted', 'value' => 'granted'], ['title' => 'Filed', 'value' => 'filed'], ['title' => 'Published', 'value' => 'published']]),
            ]))),
            self::row([self::text('DOI Link', 'doi_link', 'DOI Link')]),
            $faculty ? null : self::row([self::firstPage(null)]),
            self::submit(),
        ]));
    }
}
