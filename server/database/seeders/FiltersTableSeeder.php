<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class FiltersTableSeeder extends Seeder
{
    public function run(): void
    {
        $filters = [
            [
                'key_name' => 'student.roll_no',
                'label' => 'Student Roll',
                'data_type' => 'string',
                'function_name' => 'text',
                'applicable_pages' => ['forms', 'departments'],
                'options' => null,
                'api_url' => null,
            ],
            [
                'key_name' => 'student.department.name',
                'label' => 'Department',
                'data_type' => 'string',
                'function_name' => 'text',
                'applicable_pages' => ['forms', 'presentation'],
                'options' => null,
                'api_url' => '/suggestions/department',
            ],
            [
                'key_name' => 'student.supervisors.user.first_name',
                'label' => 'Supervisor Name',
                'data_type' => 'string',
                'function_name' => 'text',
                'applicable_pages' => ['forms', 'presentation'],
                'options' => null,
                'api_url' => '/suggestions/faculty',
            ],
            [
                'key_name' => 'student.overall_progress',
                'label' => 'Overall Progress',
                'data_type' => 'number',
                'function_name' => 'number',
                'applicable_pages' => ['forms', 'presentation'],
                'options' => null,
                'api_url' => null,
            ],
            [
                // Same key_name as the projects page's Status filter below,
                // but a different applicable_pages/label/options — the two
                // rows coexist (key_name alone is no longer unique; see
                // 2026_09_07_120000_drop_unique_key_name_from_filters).
                'key_name' => 'status',
                'label' => 'Form Status',
                'data_type' => 'select',
                'function_name' => 'select',
                'applicable_pages' => ['forms', 'presentation'],
                'options' => [
                    ['title' => 'Pending', 'value' => 'pending'],
                    ['title' => 'Draft', 'value' => 'draft'],
                    ['title' => 'Complete', 'value' => 'complete'],
                ],
                'api_url' => null,
            ],
            [
                'key_name' => 'updated_at',
                'label' => 'Last Updated',
                'data_type' => 'date',
                'function_name' => 'date',
                'applicable_pages' => ['forms', 'presentation'],
                'options' => null,
                'api_url' => null,
            ],
            [
                'key_name' => 'date',
                'label' => 'Presentation Date',
                'data_type' => 'date',
                'function_name' => 'date',
                'applicable_pages' => ['presentation'],
                'options' => null,
                'api_url' => null,
            ],
            [
                'key_name' => 'period_of_report',
                'label' => 'Period of Report',
                'data_type' => 'text',
                'function_name' => 'text',
                'applicable_pages' => ['presentation'],
                'options' => null,
                'api_url' => null,
            ],
            [
                'key_name' => 'teaching_work',
                'label' => 'Teaching Work',
                'data_type' => 'text',
                'function_name' => 'text',
                'applicable_pages' => ['presentation'],
                'options' => [
                    ['title' => 'UG', 'value' => 'UG'],
                    ['title' => 'PG', 'value' => 'PG'],
                    ['title' => 'UG and PG', 'value' => 'Both'],
                    ['title' => 'Not Applicable', 'value' => 'None'],
                ],
                'api_url' => null,
            ],
            [
                'key_name' => 'supervisors.user.first_name',
                'label' => 'Supervisor Name',
                'data_type' => 'string',
                'function_name' => 'text',
                'applicable_pages' => ['student'],
                'options' => null,
                'api_url' => '/suggestions/faculty',
            ],
            [
                'key_name' => 'department.name',
                'label' => 'Department',
                'data_type' => 'string',
                'function_name' => 'text',
                'applicable_pages' => ['student', 'faculty'],
                'options' => null,
                'api_url' => '/suggestions/department',
            ],
            [
                'key_name' => 'roll_no',
                'label' => 'Roll No',
                'data_type' => 'string',
                'function_name' => 'text',
                'applicable_pages' => ['student'],
                'options' => null,
                'api_url' => null,
            ],
            [
                'key_name' => 'user.first_name',
                'label' => 'Name',
                'data_type' => 'string',
                'function_name' => 'text',
                'applicable_pages' => ['student', 'faculty'],
                'options' => null,
                'api_url' => null,
            ],
            [
                'key_name' => 'user.email',
                'label' => 'Email',
                'data_type' => 'string',
                'function_name' => 'text',
                'applicable_pages' => ['student', 'faculty'],
                'options' => null,
                'api_url' => null,
            ],
            [
                'key_name' => 'user.phone',
                'label' => 'Phone',
                'data_type' => 'string',
                'function_name' => 'text',
                'applicable_pages' => ['student', 'faculty'],
                'options' => null,
                'api_url' => null,
            ],
            [
                'key_name' => 'form.complete_form_stage',
                'label' => 'Form Type (Completed)',
                'data_type' => 'composite',
                'function_name' => 'form_stage_combo',
                // One row served on all three pages — applicable_pages is a
                // membership list, not a page discriminator.
                'applicable_pages' => ['student', 'forms', 'presentation'],
                'options' => [
                    ['title' => 'IRB Submission', 'value' => ['form_type' => 'irb-submission', 'stage' => 'complete']],
                    ['title' => 'IRB Constitutuion', 'value' => ['form_type' => 'irb-constitution', 'stage' => 'complete']],
                    ['title' => 'Supervisor Allocation', 'value' => ['form_type' => 'supervisor-allocation', 'stage' => 'complete']],
                    ['title' => 'Thesis Submission', 'value' => ['form_type' => 'thesis-submission', 'stage' => 'complete']],
                    ['title' => 'Synopsis Submission', 'value' => ['form_type' => 'synopsis-submission', 'stage' => 'complete']],
                ],
                'api_url' => null,
            ],
            // Projects page filters.
            [
                'key_name' => 'title',
                'label' => 'Project Title',
                'data_type' => 'string',
                'function_name' => 'text',
                'applicable_pages' => ['projects'],
                'options' => null,
                'api_url' => null,
            ],
            [
                'key_name' => 'category',
                'label' => 'Category',
                'data_type' => 'select',
                'function_name' => 'select',
                'applicable_pages' => ['projects'],
                'options' => [
                    ['title' => 'In-house', 'value' => 'In-house'],
                    ['title' => 'Research', 'value' => 'Research'],
                    ['title' => 'Consultancy', 'value' => 'Consultancy'],
                    ['title' => 'Industry', 'value' => 'Industry'],
                    ['title' => 'International', 'value' => 'International'],
                    ['title' => 'Other', 'value' => 'Other'],
                ],
                'api_url' => null,
            ],
            [
                'key_name' => 'status',
                'label' => 'Project Status',
                'data_type' => 'select',
                'function_name' => 'select',
                'applicable_pages' => ['projects'],
                'options' => [
                    ['title' => 'Active', 'value' => 'Active'],
                    ['title' => 'Completed', 'value' => 'Completed'],
                    ['title' => 'Pending', 'value' => 'Pending'],
                    ['title' => 'On Hold', 'value' => 'On Hold'],
                ],
                'api_url' => null,
            ],
            [
                'key_name' => 'funding_agency',
                'label' => 'Funding Agency',
                'data_type' => 'string',
                'function_name' => 'text',
                'applicable_pages' => ['projects'],
                'options' => null,
                'api_url' => null,
            ],
            [
                'key_name' => 'amount',
                'label' => 'Sanctioned Amount',
                'data_type' => 'number',
                'function_name' => 'number',
                'applicable_pages' => ['projects'],
                'options' => null,
                'api_url' => null,
            ],
            [
                'key_name' => 'duration_years',
                'label' => 'Duration (Years)',
                'data_type' => 'number',
                'function_name' => 'number',
                'applicable_pages' => ['projects'],
                'options' => null,
                'api_url' => null,
            ],
            [
                'key_name' => 'start_date',
                'label' => 'Start Date',
                'data_type' => 'date',
                'function_name' => 'date',
                'applicable_pages' => ['projects'],
                'options' => null,
                'api_url' => null,
            ],
            [
                'key_name' => 'pi.user.first_name',
                'label' => 'Principal Investigator',
                'data_type' => 'string',
                'function_name' => 'text',
                'applicable_pages' => ['projects'],
                'options' => null,
                'api_url' => '/suggestions/faculty',
            ],
            [
                'key_name' => 'pi.department.name',
                'label' => 'PI Department',
                'data_type' => 'string',
                'function_name' => 'text',
                'applicable_pages' => ['projects'],
                'options' => null,
                'api_url' => '/suggestions/department',
            ],
        ];

        foreach ($filters as $filter) {
            $keyName = $filter['key_name'];
            unset($filter['key_name']);

            $pages = $filter['applicable_pages'];
            $filter['applicable_pages'] = json_encode($pages);
            if (isset($filter['options']) && is_array($filter['options'])) {
                $filter['options'] = json_encode($filter['options']);
            }

            // key_name is no longer unique on its own — two pages can
            // legitimately have a filter with the same key_name (e.g.
            // `status`), so the row identity is (key_name, applicable_pages).
            // This keeps the whole seeder idempotent: running it twice
            // updates each row in place rather than duplicating or
            // colliding with an unrelated page's row of the same key_name.
            DB::table('filters')->updateOrInsert(
                ['key_name' => $keyName, 'applicable_pages' => $filter['applicable_pages']],
                $filter
            );
        }
    }
}
