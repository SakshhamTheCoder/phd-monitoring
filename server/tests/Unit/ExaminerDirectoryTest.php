<?php

namespace Tests\Unit;

use App\Models\Examiner;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * An examiner used to exist only as a row on the form that proposed them, so
 * the same person was stored once per form and the search returned a hit per
 * form rather than per person. The directory is what makes them one record.
 */
class ExaminerDirectoryTest extends TestCase
{
    use DatabaseTransactions;

    private array $details = [
        'name' => 'Ada Lovelace',
        'email' => 'ada@example.invalid',
        'institution' => 'Analytical Engine Institute',
        'designation' => 'Professor',
        'department' => 'Mathematics',
        'phone' => '9000000001',
    ];

    public function test_the_same_person_is_stored_once(): void
    {
        $first = Examiner::fromDetails($this->details);
        $second = Examiner::fromDetails($this->details);

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, Examiner::where('email', $this->details['email'])->count());
    }

    /** Supervisors type addresses however they type them. */
    public function test_the_email_is_matched_regardless_of_case_or_spacing(): void
    {
        $first = Examiner::fromDetails($this->details);
        $second = Examiner::fromDetails(array_merge($this->details, [
            'email' => '  Ada@Example.Invalid  ',
        ]));

        $this->assertSame($first->id, $second->id);
        $this->assertSame('ada@example.invalid', $first->fresh()->email);
    }

    /** A hurried second entry must not undo a corrected first one. */
    public function test_existing_details_are_not_overwritten(): void
    {
        $examiner = Examiner::fromDetails($this->details);

        Examiner::fromDetails(array_merge($this->details, [
            'name' => 'A. Lovelace',
            'institution' => 'Typo Institute',
        ]));

        $examiner->refresh();
        $this->assertSame('Ada Lovelace', $examiner->name);
        $this->assertSame('Analytical Engine Institute', $examiner->institution);
    }

    /** A gap left blank the first time is worth filling from a later proposal. */
    public function test_a_missing_detail_is_filled_in(): void
    {
        $examiner = Examiner::fromDetails(array_merge($this->details, ['phone' => null]));
        $this->assertNull($examiner->phone);

        Examiner::fromDetails($this->details);

        $this->assertSame('9000000001', $examiner->fresh()->phone);
    }
}
