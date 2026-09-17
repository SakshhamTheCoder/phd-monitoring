<?php

namespace App\Http\Controllers\Traits;

use App\Models\Student;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

trait FilterLogicTrait
{

    protected function applyHasNestedRelationFilters($query, array $filters, $combinator = 'and')
{
    $combinator = strtolower($combinator);

    $method = $combinator === 'or' ? 'orWhereHas' : 'whereHas';

    foreach ($filters as $filter) {
        $relation = $filter['relation'] ?? null;
        $field = $filter['field'] ?? null;
        $operator = $filter['operator'] ?? '=';
        $value = $filter['value'] ?? null;

        if (!$relation || !$field || $value === null) continue;

        $query->{$method}($relation, function ($q) use ($field, $operator, $value) {
            switch (strtolower($operator)) {
                case 'like':
                    $q->where($field, 'LIKE', "%$value%");
                    break;
                case 'in':
                    $q->whereIn($field, explode(',', $value));
                    break;
                case 'null':
                    $q->whereNull($field);
                    break;
                case 'notnull':
                    $q->whereNotNull($field);
                    break;
                default:
                    $q->where($field, $operator, $value);
            }
        });
    }

    return $query;
}

//working

/**
 * Applies the filter bar's conditions.
 *
 * $pages names the page (or pages) the request belongs to, and $extraKeys the
 * keys its own code sends. Anything else is dropped: the keys arrive from the
 * client, and an unrestricted key is a query over any column in the database,
 * which includes password hashes.
 */
public function applyDynamicFilters($query, $filters, $pages = null, array $extraKeys = [])
{
    $combine = strtolower($filters['combine'] ?? 'and');
    $filterList = $this->allowedFilters($filters['conditions'] ?? [], $pages, $extraKeys);
    $mandatoryFilter = $this->allowedFilters($filters['mandatory_filter'] ?? null, $pages, $extraKeys) ?: null;

    Log::info('Applying dynamic filters', [
        'combine' => $combine,
        'filters' => $filterList,
        'mandatory_filter' => $mandatoryFilter
    ]);

    // Apply mandatory filter first (if any)
    if ($mandatoryFilter && is_array($mandatoryFilter)) {
        foreach ($mandatoryFilter as $filter) {
            if (isset($filter['key'], $filter['value'])) {
                $op = $filter['op'] ?? '=';
                $value = $filter['value'];

                if ($op === 'LIKE') {
                    $value = "%$value%";
                }

                $this->applyCondition($query, $filter['key'], $op, $value);
            }
        }
    }

    // Apply other dynamic filters.
    //
    // The search box sends one value across every field at once, which is an
    // OR. The filter panel sends a value per field, and may send several for
    // the same field: two departments mean either department, while a roll
    // number as well as a department means both. So conditions are grouped by
    // the key they name, each group an OR, and the groups narrow each other.
    $query->where(function ($q) use ($combine, $filterList) {
        if ($combine === 'or') {
            foreach ($filterList as $filter) {
                [$op, $value] = $this->conditionParts($filter);
                $this->applyCondition($q, $filter['key'], $op, $value, true);
            }

            return;
        }

        foreach (collect($filterList)->groupBy('key') as $conditions) {
            $q->where(function ($group) use ($conditions) {
                foreach ($conditions as $filter) {
                    [$op, $value] = $this->conditionParts($filter);
                    $this->applyCondition($group, $filter['key'], $op, $value, true);
                }
            });
        }
    });

    Log::info('Final SQL', [
        'sql' => $query->toSql(),
        'bindings' => $query->getBindings()
    ]);

    return $query;
}


//new 


/** A condition's operator and value, with a search value wrapped for matching. */
private function conditionParts(array $filter): array
{
    $op = $filter['op'] ?? '=';
    $value = $filter['value'] ?? null;

    return [$op, $op === 'LIKE' ? "%$value%" : $value];
}

/**
 * The conditions whose key the page actually offers. A key the page never
 * defined is dropped with a warning rather than run.
 */
private function allowedFilters($conditions, $pages, array $extraKeys)
{
    if (!is_array($conditions) || !$conditions) {
        return $conditions === null ? null : [];
    }

    $allowed = DB::table('filters')
        ->when($pages, fn ($q) => $q->where(function ($inner) use ($pages) {
            foreach ((array) $pages as $page) {
                $inner->orWhereJsonContains('applicable_pages', $page);
            }
        }))
        ->pluck('key_name')
        ->merge($extraKeys)
        ->flip();

    return collect($conditions)
        ->filter(function ($condition) use ($allowed) {
            $key = $condition['key'] ?? null;
            if ($key !== null && $allowed->has($key)) {
                return true;
            }
            Log::warning('Ignored a filter on a key this page does not offer', ['key' => $key]);

            return false;
        })
        ->values()
        ->all();
}

public function getAvailableFilters($pageSlug = null)
{
    return DB::table('filters')
        ->when(
            $pageSlug,
            fn($q) =>
            $q->whereJsonContains('applicable_pages', $pageSlug)
        )
        ->get()
        ->map(function ($filter) {
            $filter->options = json_decode($filter->options, true);
            $filter->applicable_pages = json_decode($filter->applicable_pages, true);
            return $filter;
        });
}





/**
 * One condition, applied to the query.
 *
 * A key may name two columns separated by "|", for something a row records
 * twice: the two students on a URF project, say, or its two mentors. Either
 * column matching is a match, so the parts are grouped rather than narrowed.
 */
private function applyCondition($query, string $key, $op, $value, bool $or = false)
{
    $parts = explode('|', $key);

    if (count($parts) > 1) {
        return $query->{$or ? 'orWhere' : 'where'}(function ($group) use ($parts, $op, $value) {
            foreach ($parts as $part) {
                $this->applyCondition($group, $part, $op, $value, true);
            }
        });
    }

    $relationPath = explode('.', $key);
    $column = array_pop($relationPath);
    $relation = implode('.', $relationPath);

    if ($relation) {
        return $query->{$or ? 'orWhereHas' : 'whereHas'}($relation, function ($q) use ($column, $op, $value) {
            $this->whereColumnMatches($q, $column, $op, $value);
        });
    }

    return $this->whereColumnMatches($query, $column, $op, $value, $or);
}

/**
 * One condition on one column.
 *
 * Names are stored as first_name and last_name, so a search for "Arun Mehta"
 * matches neither on its own. A search value with a space is matched against
 * the two joined, which is how the suggestion lists and the tables show a
 * name. Only a search: an exact condition still means the column it names.
 */
private function whereColumnMatches($query, $column, $op, $value, $or = false)
{
    $where = $or ? 'orWhere' : 'where';

    if ($op === 'LIKE' && $column === 'first_name' && is_string($value) && str_contains(trim($value, '%'), ' ')) {
        $name = '%' . trim($value, '% ') . '%';

        return $query->{$where . 'Raw'}("CONCAT(first_name, ' ', last_name) LIKE ?", [$name]);
    }

    return $query->{$where}($column, $op, $value);
}

//     public function evaluateFilter($form, $filterKey, $input)
//     {
//         $function = $this->getFilterFunction($filterKey);

//         if ($function && method_exists($this, $function)) {
//             return $this->$function($form, $input);
//         }

//         return true;
//     }
//     protected function applyHasNestedRelationFilter($query, $relationPath, $field, $value, $exact = false)
// {
//     return $query->whereHas($relationPath, function ($q) use ($field, $value, $exact) {
//         if ($exact) {
//             $q->where($field, $value);
//         } else {
//             $q->where($field, 'LIKE', "%$value%");
//         }
//     });
// }


//     public function getFilterFunction($filterKey)
//     {
//         return DB::table('filters')
//             ->where('key_name', $filterKey)
//             ->value('function_name');
//     }



//     protected function applyFilterByStudentName($query, $input)
// {
//     return $query->whereHas('student.user', function ($q) use ($input) {
//         $q->whereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%$input%"]);
//     });
// }

// protected function applyFilterByStudentEmail($query, $input)
// {
//     return $query->whereHas('student.user', function ($q) use ($input) {
//         $q->where('email', 'LIKE', "%$input%");
//     });
// }

    
//     protected function applyFilterByStudentSupervisor($query, $input)
//     {
//         return $query->whereHas(
//             'student',
//             fn($q) =>
//             $q->where('supervisor', 'LIKE', '%' . $input . '%')
//         );
//     }
//     protected function applyFilterByStudentStatus($query, $input)
//     {
//         return $query->whereHas(
//             'student',
//             fn($q) =>
//             $q->where('status', 'LIKE', '%' . $input . '%')
//         );
//     }
//     public function formScopeHasSubmittedForm($query, $formType)
//     {
//         return $query->whereHas('student.forms', function ($q) use ($formType) {
//             $q->where('stage', $formType); // or 'type' if that's your column
//         });
//     }

//     public function formScopeHasNotSubmittedForm($query, $formType)
//     {
//         return $query->whereDoesntHave('student.forms', function ($q) use ($formType) {
//             $q->where('stage', $formType); // or 'type' if applicable
//         });
//     }
}
