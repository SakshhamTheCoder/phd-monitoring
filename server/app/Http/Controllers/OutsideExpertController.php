<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\PagenationTrait;
use App\Models\OutsideExpert;
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
            $filters = $request->input('filters', []);

            $query = OutsideExpert::query();

            if ($filters) {
                $query = $this->applyDynamicFilters($query, $filters);
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
                'first_name' => 'required|string|max:255',
                'last_name' => 'required|string|max:255',
                'designation' => 'required|string|max:255',
                'department' => 'required|string|max:255',
                'institution' => 'required|string|max:255',
                'email' => 'required|email|unique:outside_experts,email',
                'phone' => 'nullable|string|unique:outside_experts,phone',
                'area_of_expertise' => 'nullable|string',
                'website' => 'nullable',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $expert = OutsideExpert::create($request->all());

            return response()->json([
                'success' => true,
                'message' => 'Outside expert added successfully',
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
                'first_name' => 'required|string|max:255',
                'last_name' => 'required|string|max:255',
                'designation' => 'required|string|max:255',
                'department' => 'required|string|max:255',
                'institution' => 'required|string|max:255',
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

            $expert->update($request->all());

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
     * Bulk import outside experts from CSV
     * CSV Format: first_name,last_name,email,phone,designation,department,institution,area_of_expertise,website
     */
    public function bulkImportFromCSV(Request $request)
    {
        try {
            $request->validate([
                'file' => 'required|file|mimes:csv,txt',
            ]);

            $file = $request->file('file');
            $csvData = array_map('str_getcsv', file($file->getRealPath()));
            $header = array_shift($csvData);

            $successCount = 0;
            $errorCount = 0;
            $errors = [];

            foreach ($csvData as $index => $row) {
                try {
                    if (count($row) < 7) {
                        $errors[] = "Row " . ($index + 2) . ": Insufficient columns";
                        $errorCount++;
                        continue;
                    }

                    $firstName = trim($row[0]);
                    $lastName = trim($row[1]);
                    $email = trim($row[2]);
                    $phone = isset($row[3]) ? trim($row[3]) : null;
                    $designation = trim($row[4]);
                    $department = trim($row[5]);
                    $institution = trim($row[6]);
                    $areaOfExpertise = isset($row[7]) ? trim($row[7]) : null;
                    $website = isset($row[8]) ? trim($row[8]) : null;

                    // Validate required fields
                    if (empty($firstName) || empty($lastName) || empty($email) || empty($designation) || empty($department) || empty($institution)) {
                        $errors[] = "Row " . ($index + 2) . ": Missing required fields";
                        $errorCount++;
                        continue;
                    }

                    // Validate email
                    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                        $errors[] = "Row " . ($index + 2) . ": Invalid email format";
                        $errorCount++;
                        continue;
                    }

                    // Check if already exists
                    $existing = OutsideExpert::where('email', $email)->first();

                    if ($existing) {
                        // Update existing record
                        $existing->update([
                            'first_name' => $firstName,
                            'last_name' => $lastName,
                            'phone' => $phone,
                            'designation' => $designation,
                            'department' => $department,
                            'institution' => $institution,
                            'area_of_expertise' => $areaOfExpertise,
                            'website' => $website,
                        ]);
                    } else {
                        // Create new record
                        OutsideExpert::create([
                            'first_name' => $firstName,
                            'last_name' => $lastName,
                            'email' => $email,
                            'phone' => $phone,
                            'designation' => $designation,
                            'department' => $department,
                            'institution' => $institution,
                            'area_of_expertise' => $areaOfExpertise,
                            'website' => $website,
                        ]);
                    }

                    $successCount++;
                } catch (\Exception $e) {
                    $errors[] = "Row " . ($index + 2) . ": " . $e->getMessage();
                    $errorCount++;
                }
            }

            return response()->json([
                'success' => true,
                'message' => "Import completed: {$successCount} successful, {$errorCount} errors",
                'data' => [
                    'success_count' => $successCount,
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
