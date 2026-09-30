<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\PagenationTrait;
use App\Models\OutsideExpert;
use App\Support\CsvRow;
use App\Support\PersonName;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class OutsideExpertController extends Controller
{
    use FilterLogicTrait, PagenationTrait;

    /**
     * Get paginated list of outside experts
     */
    public function list(Request $request)
    {
        try {
            $perPage = $request->input('rows', 15);
            $page = $request->input('page', 1);
            // The table sends its filters as JSON in the query string.
            $filtersJson = $request->query('filters');
            $filters = $filtersJson ? json_decode(urldecode($filtersJson), true) : $request->input('filters', []);

            $query = OutsideExpert::query();

            if ($filters) {
                $query = $this->applyDynamicFilters($query, $filters, 'outside_experts');
            }

            $experts = $query->orderBy('first_name')
                ->orderBy('last_name')
                ->paginate($perPage, ['*'], 'page', $page);

            return response()->json([
                'data' => $experts->items(),
                'total' => $experts->total(),
                'per_page' => $experts->perPage(),
                'current_page' => $experts->currentPage(),
                'totalPages' => $experts->lastPage(),
                'fields' => ['first_name', 'last_name', 'email', 'phone', 'institution', 'designation'],
                'fieldsTitles' => ['First Name', 'Last Name', 'Email', 'Phone', 'Institution', 'Designation'],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching outside experts: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all outside experts (for dropdowns)
     */
    public function all()
    {
        try {
            $experts = OutsideExpert::select('id', 'first_name', 'last_name', 'email', 'institution', 'designation')
                ->orderBy('first_name')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $experts
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching all outside experts: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Add new outside expert
     */
    public function add(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'full_name' => 'required_without:first_name|string',
                'first_name' => 'required_without:full_name|string|max:255',
                'last_name' => 'nullable|string|max:255',
                // Optional: an expert cannot sign in to fill these in later,
                // so requiring them only produced a guess in the gap.
                'designation' => 'nullable|string|max:255',
                'department' => 'nullable|string|max:255',
                'institution' => 'nullable|string|max:255',
                'email' => 'required|email|unique:outside_experts,email',
                'phone' => 'nullable|string|unique:outside_experts,phone',
                'area_of_expertise' => 'nullable|string',
                'website' => 'nullable',
            ], [
                // An expert serves any number of scholars; a second record for
                // the same person splits their history in two.
                'email.unique' => 'An outside expert with this email is already on the list. Pick them from the list instead of adding them again.',
                'phone.unique' => 'An outside expert with this phone number is already on the list. Pick them from the list instead of adding them again.',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $name = $request->filled('full_name')
                ? PersonName::split($request->input('full_name'))
                : ['first' => $request->input('first_name'), 'last' => $request->input('last_name') ?: PersonName::NO_SURNAME];

            $expert = OutsideExpert::create(array_merge(
                $request->except(['full_name', 'first_name', 'last_name']),
                ['first_name' => $name['first'], 'last_name' => $name['last']]
            ));

            return response()->json([
                'success' => true,
                'message' => 'Outside expert added successfully'
                    . (($clash = \App\Support\OtherDirectory::facultyNamed($request->email)) ? '. ' . $clash : ''),
                'data' => $expert
            ], 201);
        } catch (\Exception $e) {
            Log::error('Error adding outside expert: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update outside expert
     */
    public function update(Request $request, $id)
    {
        try {
            $expert = OutsideExpert::find($id);
            if (!$expert) {
                return response()->json([
                    'message' => 'Outside expert not found'
                ], 404);
            }

            $validator = Validator::make($request->all(), [
                'full_name' => 'required_without:first_name|string',
                'first_name' => 'required_without:full_name|string|max:255',
                'last_name' => 'nullable|string|max:255',
                'designation' => 'nullable|string|max:255',
                'department' => 'nullable|string|max:255',
                'institution' => 'nullable|string|max:255',
                'email' => 'required|email|unique:outside_experts,email,' . $id,
                'phone' => 'nullable|string|unique:outside_experts,phone,' . $id,
                'area_of_expertise' => 'nullable|string',
                'website' => 'nullable',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $name = $request->filled('full_name')
                ? PersonName::split($request->input('full_name'))
                : ['first' => $request->input('first_name'), 'last' => $request->input('last_name') ?: PersonName::NO_SURNAME];

            $expert->update(array_merge(
                $request->except(['full_name', 'first_name', 'last_name']),
                ['first_name' => $name['first'], 'last_name' => $name['last']]
            ));

            return response()->json([
                'success' => true,
                'message' => 'Outside expert updated successfully',
                'data' => $expert
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error updating outside expert: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete outside expert
     */
    public function delete($id)
    {
        try {
            $expert = OutsideExpert::find($id);
            if (!$expert) {
                return response()->json([
                    'message' => 'Outside expert not found'
                ], 404);
            }

            $expert->delete();

            return response()->json([
                'success' => true,
                'message' => 'Outside expert deleted successfully'
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error deleting outside expert: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get filters for outside experts
     */
    public function listFilters()
    {
        return response()->json($this->getAvailableFilters("outside_experts"));
    }

    /**
     * The experts sheet's rows as it has them. full_name is what the page's own
     * template asks for; the legacy first_name/last_name pair is still read so a
     * copy saved before the change still imports. Each column also answers to
     * the obvious Title Case spelling a sheet built outside the portal is likely
     * to use.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    public static function expertRows(array $rows): array
    {
        $column = fn (array $row, string ...$aliases) => CsvRow::column($row, ...$aliases);

        return array_map(fn (array $row) => [
            // The row's place in the sheet, so a refusal names the line the
            // office has to look at rather than its place in the request.
            'row_number' => $row['_rowNumber'] ?? $row['row_number'] ?? null,
            'full_name' => CsvRow::fallback(
                $column($row, 'Full Name', 'full_name', 'Name'),
                CsvRow::words($column($row, 'First Name', 'first_name'), $column($row, 'Last Name', 'last_name'))
            ),
            'email' => $column($row, 'Email', 'email'),
            'phone' => $column($row, 'Phone', 'phone', 'Phone Number'),
            'designation' => $column($row, 'Designation', 'designation'),
            'department' => $column($row, 'Department', 'department'),
            'institution' => $column($row, 'Institution', 'institution', 'Institute'),
            'area_of_expertise' => $column($row, 'Area of Expertise', 'area_of_expertise', 'Expertise'),
            'website' => $column($row, 'Website', 'website'),
        ], $rows);
    }

    /**
     * Bulk import outside experts from the sheet's rows.
     * Columns: full_name, email, phone, designation, department, institution,
     * area_of_expertise, website. Phone, area_of_expertise and website are
     * optional. Matched by email: a row whose email already exists updates that
     * expert instead of adding a second one.
     */
    public function bulkImportFromCSV(Request $request)
    {
        try {
            // The page posts the sheet's rows as they are; read here into the
            // experts the checks below validate.
            if ($request->has('rows')) {
                $request->merge(['rows' => self::expertRows((array) $request->input('rows'))]);
            }

            $request->validate([
                'rows' => 'required|array',
            ]);

            $successCount = 0;
            $updateCount = 0;
            $errorCount = 0;
            $errors = [];

            foreach ($request->input('rows') as $index => $data) {
                $rowNumber = $data['row_number'] ?? ($index + 1);

                try {
                    $name = PersonName::fromRow($data);
                    $email = trim((string) ($data['email'] ?? ''));
                    $phone = trim((string) ($data['phone'] ?? '')) !== '' ? trim((string) $data['phone']) : null;
                    $designation = trim((string) ($data['designation'] ?? ''));
                    $department = trim((string) ($data['department'] ?? ''));
                    $institution = trim((string) ($data['institution'] ?? ''));
                    $areaOfExpertise = trim((string) ($data['area_of_expertise'] ?? '')) !== '' ? trim((string) $data['area_of_expertise']) : null;
                    $website = trim((string) ($data['website'] ?? '')) !== '' ? trim((string) $data['website']) : null;

                    // outside_experts.first_name/last_name are NOT NULL, so a
                    // row with no name at all must be rejected rather than
                    // written with an empty string.
                    if ($name === null) {
                        $errors[] = "Row {$rowNumber}: full_name is required";
                        $errorCount++;
                        continue;
                    }

                    if (empty($email)) {
                        $errors[] = "Row {$rowNumber}: email is required";
                        $errorCount++;
                        continue;
                    }

                    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                        $errors[] = "Row {$rowNumber}: '{$email}' is not a valid email address";
                        $errorCount++;
                        continue;
                    }

                    $attributes = [
                        'first_name' => $name['first'],
                        'last_name' => $name['last'],
                        'phone' => $phone,
                        'designation' => $designation,
                        'department' => $department,
                        'institution' => $institution,
                        'area_of_expertise' => $areaOfExpertise,
                        'website' => $website,
                    ];

                    $existing = OutsideExpert::where('email', $email)->first();
                    if ($existing) {
                        $existing->update($attributes);
                        $updateCount++;
                    } else {
                        // Said once, on the row that makes the second record.
                        if ($clash = \App\Support\OtherDirectory::facultyNamed($email)) {
                            $errors[] = "Row {$rowNumber}: {$clash}";
                        }

                        OutsideExpert::create($attributes + ['email' => $email]);
                        $successCount++;
                    }
                } catch (\Exception $e) {
                    $errors[] = "Row {$rowNumber}: " . $e->getMessage();
                    $errorCount++;
                }
            }

            return response()->json([
                'success' => true,
                'message' => "Import completed: {$successCount} added, {$updateCount} updated, {$errorCount} errors",
                // What the page tells the reader, in order. Capped at three row
                // warnings, since a bad sheet can carry hundreds.
                'messages' => [
                    ['tone' => 'success', 'text' => "{$successCount} experts added, {$updateCount} updated"],
                    ...array_map(fn ($error) => ['tone' => 'warn', 'text' => $error], array_slice($errors, 0, 3)),
                    ...(count($errors) > 3 ? [['tone' => 'warn', 'text' => (count($errors) - 3) . ' more rows need checking']] : []),
                ],
                'data' => [
                    'success_count' => $successCount,
                    'update_count' => $updateCount,
                    'error_count' => $errorCount,
                    'errors' => $errors,
                ]
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error importing outside experts from CSV: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }
}
