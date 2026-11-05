<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Institution-wide aggregates for the office Home. Every block is a grouped
 * query and is skipped (null / empty) if its table or column is missing, so
 * one absent migration never blanks the whole page.
 */
class OverviewDashboard
{
    public static function roles(): array
    {
        return (array) config('dashboard.overview_roles', []);
    }

    public static function appliesTo(?string $role): bool
    {
        return $role !== null && in_array($role, self::roles(), true);
    }

    public static function build(): array
    {
        return [
            'totals' => self::safe(fn () => self::totals(), []),
            'scholars_by_department' => self::safe(fn () => self::byDepartment(), []),
            'scholars_by_status' => self::safe(fn () => self::group('students', 'current_status'), []),
            'scholars_by_admission_year' => self::safe(fn () => self::byAdmissionYear(), []),
            'scholars_by_qualification' => self::safe(fn () => self::group('students', 'highest_qualification'), []),
            'scholars_by_net_gate' => self::safe(fn () => self::group('students', 'net_gate'), []),
            'progress' => self::safe(fn () => self::progress(), null),
            'forms_pending_by_stage' => self::safe(fn () => self::formsByStage(), []),
            'evaluations_by_stage' => self::safe(fn () => self::evaluationsByStage(), []),
            'urf_by_status' => self::safe(fn () => self::group('urf_applications', 'status'), []),
            'projects_by_status' => self::safe(fn () => self::group('projects', 'status'), []),
            'publications_by_year' => self::safe(fn () => self::publicationsByYear(), []),
            'recent_activity' => self::safe(fn () => self::recentActivity(), []),
        ];
    }

    private static function safe(callable $fn, $fallback)
    {
        try {
            return $fn();
        } catch (Throwable $e) {
            report($e);
            return $fallback;
        }
    }

    private static function has(string $table, string $column = null): bool
    {
        return Schema::hasTable($table) && ($column === null || Schema::hasColumn($table, $column));
    }

    private static function count(string $table, ?string $where = null): ?int
    {
        if (!self::has($table)) {
            return null;
        }
        $q = DB::table($table);
        if ($where) {
            $q->whereRaw($where);
        }
        return $q->count();
    }

    private static function totals(): array
    {
        return [
            'scholars' => self::count('students'),
            'faculty' => self::count('faculty'),
            'supervisors' => self::has('supervisors') ? DB::table('supervisors')->distinct()->count('faculty_id') : null,
            'departments' => self::count('departments'),
            'projects' => self::count('projects'),
            'urf_applications' => self::count('urf_applications'),
            'publications' => self::count('publications'),
            'forms_pending' => self::has('forms', 'stage')
                ? DB::table('forms')->where('stage', '!=', 'complete')->count() : null,
        ];
    }

    /** [{label, count}] ordered by count desc, nulls shown as "Not recorded". */
    private static function group(string $table, string $column, int $limit = 30): array
    {
        if (!self::has($table, $column)) {
            return [];
        }
        return DB::table($table)
            ->select($column . ' as label', DB::raw('count(*) as count'))
            ->groupBy($column)
            ->orderByDesc('count')
            ->limit($limit)
            ->get()
            ->map(fn ($r) => ['label' => $r->label ?? 'Not recorded', 'count' => (int) $r->count])
            ->all();
    }

    private static function byDepartment(): array
    {
        if (!self::has('students', 'department_id') || !self::has('departments')) {
            return [];
        }
        return DB::table('students')
            ->join('departments', 'departments.id', '=', 'students.department_id')
            ->select('departments.name as label', 'departments.code as code', DB::raw('count(*) as count'))
            ->groupBy('departments.id', 'departments.name', 'departments.code')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($r) => ['label' => $r->label, 'code' => $r->code, 'count' => (int) $r->count])
            ->all();
    }

    private static function byAdmissionYear(): array
    {
        if (!self::has('students', 'date_of_registration')) {
            return [];
        }
        return DB::table('students')
            ->whereNotNull('date_of_registration')
            ->selectRaw('substr(date_of_registration, 1, 4) as label, count(*) as count')
            ->groupBy('label')
            ->orderBy('label')
            ->get()
            ->map(fn ($r) => ['label' => (string) $r->label, 'count' => (int) $r->count])
            ->all();
    }

    private static function progress(): ?array
    {
        if (!self::has('students', 'overall_progress')) {
            return null;
        }
        $row = DB::table('students')->selectRaw(
            'avg(overall_progress) as avg,'
            . ' sum(case when overall_progress is null then 1 else 0 end) as unrecorded,'
            . ' sum(case when overall_progress < 25 then 1 else 0 end) as b1,'
            . ' sum(case when overall_progress >= 25 and overall_progress < 50 then 1 else 0 end) as b2,'
            . ' sum(case when overall_progress >= 50 and overall_progress < 75 then 1 else 0 end) as b3,'
            . ' sum(case when overall_progress >= 75 then 1 else 0 end) as b4'
        )->first();

        return [
            'average' => $row->avg !== null ? round((float) $row->avg, 1) : null,
            'unrecorded' => (int) $row->unrecorded,
            'buckets' => [
                ['label' => '0-24%', 'count' => (int) $row->b1],
                ['label' => '25-49%', 'count' => (int) $row->b2],
                ['label' => '50-74%', 'count' => (int) $row->b3],
                ['label' => '75-100%', 'count' => (int) $row->b4],
            ],
        ];
    }

    private static function formsByStage(): array
    {
        if (!self::has('forms', 'stage')) {
            return [];
        }
        return DB::table('forms')->where('stage', '!=', 'complete')
            ->select('stage as label', DB::raw('count(*) as count'))
            ->groupBy('stage')->orderByDesc('count')->get()
            ->map(fn ($r) => ['label' => $r->label, 'count' => (int) $r->count])->all();
    }

    private static function evaluationsByStage(): array
    {
        if (!self::has('presentations', 'stage')) {
            return [];
        }
        return DB::table('presentations')->where('status', 'pending')
            ->select('stage as label', DB::raw('count(*) as count'))
            ->groupBy('stage')->orderByDesc('count')->get()
            ->map(fn ($r) => ['label' => $r->label ?? 'Not recorded', 'count' => (int) $r->count])->all();
    }

    private static function publicationsByYear(): array
    {
        if (!self::has('publications', 'year')) {
            return [];
        }
        $rows = DB::table('publications')->whereNotNull('year')
            ->select('year as label', DB::raw('count(*) as count'))
            ->groupBy('year')->orderByDesc('label')->limit(8)->get();
        return $rows->reverse()->values()
            ->map(fn ($r) => ['label' => (string) $r->label, 'count' => (int) $r->count])->all();
    }

    private static function recentActivity(): array
    {
        if (!self::has('forms', 'updated_at') || !self::has('students')) {
            return [];
        }
        return DB::table('forms')
            ->join('students', 'students.roll_no', '=', 'forms.student_id')
            ->join('users', 'users.id', '=', 'students.user_id')
            ->select('forms.id', 'forms.form_name', 'forms.form_type', 'forms.stage', 'forms.updated_at',
                'students.roll_no', 'users.first_name', 'users.last_name')
            ->orderByDesc('forms.updated_at')
            ->limit(8)
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'form' => $r->form_name ?: $r->form_type,
                'form_type' => $r->form_type,
                'stage' => $r->stage,
                'roll_no' => $r->roll_no,
                'student' => trim($r->first_name . ' ' . $r->last_name),
                'updated_at' => $r->updated_at,
            ])->all();
    }
}
