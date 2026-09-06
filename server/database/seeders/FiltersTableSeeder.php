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
                // Merged: one row served on all three pages (key_name is UNIQUE, so this
                // filter cannot be duplicated per page-set — applicable_pages is a membership list).
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
        ];

        foreach ($filters as &$filter) {
            if (isset($filter['applicable_pages']) && is_array($filter['applicable_pages'])) {
                $filter['applicable_pages'] = json_encode($filter['applicable_pages']);
            }
            if (isset($filter['options']) && is_array($filter['options'])) {
                $filter['options'] = json_encode($filter['options']);
            }
        }

        DB::table('filters')->insert($filters);

        // Projects page filters. Written with updateOrInsert (keyed on the
        // unique key_name) rather than the plain insert above, so re-running
        // this seeder never duplicates these rows.
        $projectFilters = [
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

        foreach ($projectFilters as $filter) {
            $keyName = $filter['key_name'];
            unset($filter['key_name']);
            if (isset($filter['applicable_pages']) && is_array($filter['applicable_pages'])) {
                $filter['applicable_pages'] = json_encode($filter['applicable_pages']);
            }
            if (isset($filter['options']) && is_array($filter['options'])) {
                $filter['options'] = json_encode($filter['options']);
            }
            DB::table('filters')->updateOrInsert(['key_name' => $keyName], $filter);
        }
    }
}
