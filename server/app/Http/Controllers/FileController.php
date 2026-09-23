<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\ProjectAuthorizes;
use App\Models\ConstituteOfIRB;
use App\Models\IrbSubForm;
use App\Models\Patent;
use App\Models\PositionApplication;
use App\Models\Presentation;
use App\Models\Project;
use App\Models\ProjectDocument;
use App\Models\ProjectPosition;
use App\Models\Publication;
use App\Models\ResearchExtentions;
use App\Models\ResearchExtentionsForm;
use App\Models\Semester;
use App\Models\Student;
use App\Models\StudentLeaveForm;
use App\Models\StudentSemesterOff;
use App\Models\StudentSemesterOffForm;
use App\Models\SynopsisSubmission;
use App\Models\ThesisExtentionForm;
use App\Models\ThesisSubmission;
use App\Models\UrfApplication;
use App\Models\UrfReport;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

/**
 * Streams stored uploads to signed-in users who may read the record the file
 * belongs to. Uploads live on the private 'local' disk; ones from before the
 * move may still sit on the public disk until uploads:make-private runs.
 */
class FileController extends Controller
{
    use ProjectAuthorizes;

    /**
     * Every column holding a SaveFile path, copies included (a finished
     * extension or semester off keeps the form's PDF). Adding an upload column
     * means adding it here, or nobody but an admin can open the file.
     */
    public const COLUMNS = [
        ConstituteOfIRB::class => ['irb_pdf'],
        IrbSubForm::class => ['revised_irb_pdf'],
        Presentation::class => ['presentation_pdf', 'ppt_file'],
        ResearchExtentionsForm::class => ['research_pdf'],
        ResearchExtentions::class => ['research_pdf'],
        StudentLeaveForm::class => ['supporting_document'],
        StudentSemesterOffForm::class => ['previous_approval_pdf', 'proof_pdf'],
        StudentSemesterOff::class => ['proof_pdf'],
        SynopsisSubmission::class => ['synopsis_pdf', 'viva_minutes_pdf'],
        ThesisExtentionForm::class => ['previous_extention_pdf'],
        ThesisSubmission::class => ['thesis_pdf', 'fee_receipt'],
        Publication::class => ['first_page'],
        Patent::class => ['first_page'],
        Project::class => ['sanction_letter_link', 'gantt_chart_path'],
        ProjectDocument::class => ['file_path'],
        PositionApplication::class => ['resume_path'],
        ProjectPosition::class => ['advertisement_path'],
        Semester::class => ['ppt_file'],
        UrfApplication::class => ['proposal'],
        UrfReport::class => ['report'],
    ];

    /** GET /api/files?path=<stored path> */
    public function show(Request $request)
    {
        $relative = self::uploadsPath((string) $request->query('path', ''));
        if ($relative === null) {
            return response()->json(['message' => 'File not found'], 404);
        }

        $user = Auth::user();
        $records = $this->recordsReferencing($relative);
        $isAdmin = $user->current_role?->role === 'admin';
        if (!$isAdmin && $records->isEmpty()) {
            return response()->json(['message' => 'File not found'], 404);
        }
        if (!$isAdmin && !$records->contains(fn (Model $record) => $this->mayRead($user, $record))) {
            return response()->json(['message' => 'You do not have access to this file.'], 403);
        }

        $full = self::locate($relative);
        if ($full === null) {
            return response()->json(['message' => 'This file is no longer on the server. Upload it again.'], 404);
        }

        return response()->file($full, ['X-Content-Type-Options' => 'nosniff']);
    }

    /**
     * 'uploads/...' for a stored path in either shape ('/app/uploads/...' now,
     * '/app/public/uploads/...' before the move), or null for anything that
     * is not inside the uploads folder.
     */
    public static function uploadsPath(string $stored): ?string
    {
        $relative = preg_replace('#^/?app/(public/)?#', '', $stored);
        if (!str_starts_with($relative, 'uploads/') || preg_match('#\.\.|\\\\|\x00#', $relative)) {
            return null;
        }
        return $relative;
    }

    /**
     * Absolute path of the file on whichever disk holds it. realpath() plus the
     * prefix check keeps a symlink or an odd segment from escaping uploads/.
     */
    private static function locate(string $relative): ?string
    {
        foreach (['local', 'public'] as $disk) {
            $root = realpath(Storage::disk($disk)->path('uploads'));
            $full = realpath(Storage::disk($disk)->path($relative));
            if ($root && $full && str_starts_with($full, $root . DIRECTORY_SEPARATOR) && is_file($full)) {
                return $full;
            }
        }
        return null;
    }

    /** Every row that stores this file. Copies of a publication share one file. */
    private function recordsReferencing(string $relative)
    {
        $stored = ['/app/' . $relative, '/app/public/' . $relative];

        return collect(self::COLUMNS)->flatMap(fn (array $columns, string $model) => $model::where(
            function ($query) use ($columns, $stored) {
                foreach ($columns as $column) {
                    $query->orWhereIn($column, $stored);
                }
            }
        )->get());
    }

    /** The read rule of the record the file belongs to. */
    private function mayRead(User $user, Model $record): bool
    {
        return match (true) {
            $record instanceof Project => $this->canView($user, $record),
            $record instanceof ProjectDocument => $record->project !== null && $this->canView($user, $record->project),
            // The PI reads the applications (PositionApplicationController::index); the applicant reads their own.
            $record instanceof PositionApplication => ($record->student_id && $record->student_id == $user->student?->roll_no)
                || (($project = Project::find($record->project_id)) && $this->owns($user, $project)),
            // An advertisement is public on the openings page, and a semester's slides go to every scholar.
            $record instanceof ProjectPosition, $record instanceof Semester => true,
            $record instanceof UrfApplication, $record instanceof UrfReport => $this->mayReadUrf($user, $record),
            $record instanceof Publication, $record instanceof Patent => $this->mayReadLibraryEntry($user, $record),
            default => $this->mayReadScholar($user, $record->student_id),
        };
    }

    private function mayReadScholar(User $user, $rollNo): bool
    {
        $student = $rollNo ? Student::find($rollNo) : null;
        return $student !== null && $student->isReadableBy($user);
    }

    /** As UrfController::formShow: the office, or a step on the project's chain. */
    private function mayReadUrf(User $user, $urfForm): bool
    {
        return $urfForm !== null && ($user->may('can_manage_urf') || $urfForm->stepFor($user) !== null);
    }

    /** A scholar's entry follows the scholar; a UG student's follows its owner and the URF project it is filed on. */
    private function mayReadLibraryEntry(User $user, Model $entry): bool
    {
        if ($entry->student_id) {
            return $this->mayReadScholar($user, $entry->student_id);
        }
        if ($entry->user_id && $entry->user_id == $user->id) {
            return true;
        }
        return $entry->urf_application_id !== null
            && $this->mayReadUrf($user, UrfApplication::find($entry->urf_application_id));
    }
}
