<?php

namespace App\Http\Controllers;

use App\Models\Approval;
use App\Models\IrbSubForm;
use App\Models\OutsideExpert;
use Illuminate\Http\Request;

/**
 * Public, token-authenticated external-expert review flow. The token (Approval->key) is
 * the sole credential — no login/account. GET only reads (safe against email prefetch);
 * only POST records a decision. Whitelist keeps the expert from seeing anything but the
 * review essentials, and every other API stays behind auth:sanctum.
 */
class ExternalReviewController extends Controller
{
    /** Roles allowed to resend a review request. */
    private const RESEND_ROLES = ['dordc', 'phd_coordinator', 'admin'];

    /** GET /api/external-review/{token} — whitelisted details + current state. Read-only. */
    public function show($token)
    {
        $approval = Approval::where('key', $token)->first();
        if (!$approval) {
            return response()->json(['state' => 'invalid', 'message' => 'This review link is not valid.'], 404);
        }

        $form = $this->form($approval);
        if (!$form) {
            return response()->json(['state' => 'invalid', 'message' => 'This submission no longer exists.'], 404);
        }

        $expert = OutsideExpert::where('email', $approval->email)->first();

        if ($approval->consumed_at) {
            $state = 'responded';
        } elseif ($form->stage === 'external') {
            $state = 'pending';
        } else {
            $state = 'closed';
        }

        return response()->json([
            'state'         => $state,
            'expert_name'   => $expert ? trim($expert->first_name . ' ' . $expert->last_name) : null,
            'student_name'  => $form->student?->user?->name(),
            'title'         => $form->revised_phd_title,
            'department'    => $form->student?->department?->name,
            'form_id'       => $form->id,
            'pdf_url'       => $form->revised_irb_pdf ? url('/api/external-review/' . $token . '/pdf') : null,
            'decision'      => $approval->consumed_at ? ($approval->approved ? 'recommend' : 'not_recommend') : null,
            'comment'       => $approval->consumed_at ? $approval->comment : null,
            'responded_at'  => $approval->consumed_at,
        ]);
    }

    /** GET /api/external-review/{token}/pdf — stream the IRB PDF (token-gated, public). */
    public function pdf($token)
    {
        $approval = Approval::where('key', $token)->first();
        if (!$approval) {
            abort(404);
        }
        $form = $this->form($approval);
        if (!$form || !$form->revised_irb_pdf) {
            abort(404);
        }
        $path = storage_path($form->revised_irb_pdf);
        if (!is_file($path)) {
            abort(404);
        }
        return response()->file($path);
    }

    /** POST /api/external-review/{token} — record the decision. Single-use. */
    public function submit(Request $request, $token)
    {
        $approval = Approval::where('key', $token)->first();
        if (!$approval) {
            return response()->json(['message' => 'This review link is not valid.'], 404);
        }
        if ($approval->consumed_at) {
            return response()->json(['message' => 'You have already responded to this review.'], 409);
        }

        $form = $this->form($approval);
        if (!$form) {
            return response()->json(['message' => 'This submission no longer exists.'], 404);
        }
        if ($form->stage !== 'external') {
            return response()->json(['message' => 'This review is no longer required.'], 409);
        }

        $data = $request->validate([
            'decision' => 'required|in:recommend,not_recommend',
            'comment'  => 'nullable|string',
        ]);
        $recommend = $data['decision'] === 'recommend';
        $comment = trim($data['comment'] ?? '');
        if (!$recommend && $comment === '') {
            return response()->json(['message' => 'A comment is required when not recommending.'], 422);
        }

        // Advance the workflow exactly as before (external -> doctoral, or back to faculty
        // on not-recommend). Only mark the token consumed if that succeeded.
        $result = $form->handleApproval($approval->email, $form->id, $recommend, $comment ?: null);
        $status = method_exists($result, 'getStatusCode') ? $result->getStatusCode() : 200;
        if ($status >= 400) {
            return $result;
        }

        $approval->approved = $recommend;
        $approval->comment = $comment ?: null;
        $approval->consumed_at = now();
        $approval->save();

        return response()->json(['message' => 'Your review has been recorded. Thank you.']);
    }

    /** POST /api/irb-submissions/{id}/resend-external-review — resend the same token. Authed. */
    public function resend(Request $request, $id)
    {
        $role = $request->user()?->current_role?->role;
        if (!in_array($role, self::RESEND_ROLES, true)) {
            return response()->json(['message' => 'You are not authorized to resend this review.'], 403);
        }

        $form = IrbSubForm::find($id);
        if (!$form) {
            return response()->json(['message' => 'Submission not found.'], 404);
        }

        $existing = Approval::where('model_type', IrbSubForm::class)->where('model_id', $id)->first();
        if ($existing && $existing->consumed_at) {
            return response()->json(['message' => 'The expert has already responded; nothing to resend.'], 409);
        }
        if ($form->stage !== 'external') {
            return response()->json(['message' => 'This submission is not awaiting external review.'], 409);
        }

        $sent = $form->sendExternalReviewRequest();
        if (!$sent) {
            return response()->json(['message' => 'No outside expert is assigned to this submission.'], 422);
        }

        return response()->json(['message' => 'Review request resent to the expert.']);
    }

    /** Resolve the form behind an Approval (only IrbSubForm is supported here). */
    private function form(Approval $approval)
    {
        if ($approval->model_type !== IrbSubForm::class) {
            return null;
        }
        return IrbSubForm::find($approval->model_id);
    }
}
