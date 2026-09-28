<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Student;
use App\Support\CourseworkRequirement;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The institute's own table of credits, which goes by school and admission
 * date. Every figure here is read off the sheet the DoRDC published.
 */
class CourseworkRequirementTest extends TestCase
{
    use DatabaseTransactions;

    private function scholar(string $departmentCode, ?string $admitted, string $status = 'full-time'): Student
    {
        $department = new Department(['code' => $departmentCode]);

        $student = new Student();
        $student->current_status = $status;
        $student->date_of_registration = $admitted;
        $student->setRelation('department', $department);

        return $student;
    }

    public static function cohorts(): array
    {
        return [
            'engineering before July 2020' => ['MED', '2019-07-31', 11],
            'engineering the day before the band changes' => ['CSED', '2020-06-30', 11],
            'engineering from July 2020' => ['CSED', '2020-07-01', 14],
            'engineering in the middle band' => ['ECED', '2023-01-19', 14],
            'engineering the day before July 2024' => ['ECED', '2024-06-30', 14],
            'engineering from July 2024' => ['ECED', '2024-07-01', 36],
            'sciences in the newest band' => ['DPMS', '2025-08-07', 36],
            'humanities in the oldest band' => ['DHSS', '2018-07-27', 11],
            'management before July 2024' => ['LMTSM', '2022-09-30', 48],
            'management from July 2024' => ['LMTSM', '2024-08-20', 36],
            'management under its older code' => ['DOM', '2021-09-20', 48],
            'liberal arts, whenever they came' => ['TSLAS', '2019-07-31', 45],
            'liberal arts, newest band' => ['TSLAS', '2025-10-09', 45],
        ];
    }

    /** Settings are read live, so a figure changed in one test must not leak. */
    protected function setUp(): void
    {
        parent::setUp();
        \App\Models\AppSetting::forgetCache();
    }

    /** @dataProvider cohorts */
    public function test_a_cohort_is_measured_against_its_own_figure(string $code, string $admitted, int $expected): void
    {
        $this->assertSame($expected, CourseworkRequirement::for($this->scholar($code, $admitted)));
    }

    /** The executive programme is the UGC figure, whatever the school. */
    public function test_the_executive_programme_asks_for_the_ugc_minimum(): void
    {
        foreach ([['MED', '2019-07-31'], ['LMTSM', '2022-09-30'], ['TSLAS', '2025-10-09']] as [$code, $admitted]) {
            $this->assertSame(12, CourseworkRequirement::for($this->scholar($code, $admitted, 'executive')), $code);
        }
    }

    /** A part time scholar is in the same cohort as a full time one. */
    public function test_part_time_changes_nothing(): void
    {
        $this->assertSame(36, CourseworkRequirement::for($this->scholar('MED', '2025-08-07', 'part-time')));
        $this->assertSame(48, CourseworkRequirement::for($this->scholar('LMTSM', '2021-09-20', 'part-time')));
    }

    /** With no admission date there is no cohort, so the long-standing figure stands. */
    public function test_a_scholar_without_an_admission_date_keeps_the_old_figure(): void
    {
        $this->assertSame(14, CourseworkRequirement::for($this->scholar('CSED', null)));
        $this->assertSame(45, CourseworkRequirement::for($this->scholar('TSLAS', null)), 'liberal arts is one figure regardless');
    }
    /** The office can correct a figure when the regulation moves. */
    public function test_a_figure_corrected_in_settings_is_what_the_gate_uses(): void
    {
        $scholar = $this->scholar('CSED', '2025-08-07');
        $this->assertSame(36, CourseworkRequirement::for($scholar));

        \App\Models\AppSetting::put('coursework', 'min_credits_from_july_2024', 30);
        $this->assertSame(30, CourseworkRequirement::for($scholar));
    }
}
