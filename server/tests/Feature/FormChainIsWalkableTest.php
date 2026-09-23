<?php

namespace Tests\Feature;

use App\Http\Controllers\Traits\GeneralFormSubmitter;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Route;
use ReflectionClass;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Every role a form's chain names has to be able to hand the form on.
 *
 * A form's chain is built in its own controller. The submission is dispatched by
 * that controller's submit(), which switches on the acting role. A role that is
 * in the chain but has no branch in the switch cannot pass the form along, and
 * since submitForm() writes the next role into `stage` and then refuses anyone
 * who is not that role, the form stops there permanently.
 *
 * That is not hypothetical. Thesis Extension's second, special extension is
 * handed on by dordcSubmit with nextLevel 'director'. `directorSubmit` existed
 * and was correct, but the switch had no `case 'director'`, so the request fell
 * to `default` and was refused. Every special extension reached the Vice
 * Chancellor and could go no further.
 *
 * Reading the source rather than driving each form end to end is deliberate:
 * this asks one narrow question of all fourteen forms, and it is the question
 * that was being answered wrongly.
 */
class FormChainIsWalkableTest extends TestCase
{
    use DatabaseTransactions;

    /** form type => the controller that owns its chain. */
    private const FORMS = [
        'irb-constitution' => \App\Http\Controllers\ConstituteOfIRBController::class,
        'irb-submission' => \App\Http\Controllers\IrbSubController::class,
        'irb-extension' => \App\Http\Controllers\ResearchExtentionController::class,
        'synopsis-submission' => \App\Http\Controllers\SynopsisSubmissionController::class,
        'revise-title' => \App\Http\Controllers\ReviseTitleController::class,
        'thesis-submission' => \App\Http\Controllers\ThesisSubmissionController::class,
        'thesis-extension' => \App\Http\Controllers\ThesisExtentionController::class,
        'supervisor-change' => \App\Http\Controllers\SupervisorChangeFormController::class,
        'supervisor-allocation' => \App\Http\Controllers\SupervisorAllocationController::class,
        'status-change' => \App\Http\Controllers\StatusChangeFormController::class,
        'semester-off' => \App\Http\Controllers\StudentSemesterOffFormController::class,
        'list-of-examiners' => \App\Http\Controllers\ListOfExaminersController::class,
        'presentation' => \App\Http\Controllers\PresentationController::class,
    ];

    /**
     * Steps that are not a role anyone submits as.
     *
     * 'complete' terminates a chain. 'external' is answered through the token
     * link in ExternalReviewController, not by a signed-in user posting to the
     * form endpoint.
     */
    private const NOT_SUBMITTED_HERE = ['complete', 'external'];

    public static function forms(): array
    {
        return array_map(fn ($type) => [$type], array_keys(self::FORMS));
    }

    private function source(string $controller): string
    {
        return file_get_contents((new ReflectionClass($controller))->getFileName());
    }

    /**
     * Every literal chain the controller builds, longest first.
     *
     * A controller with more than one chain declares them as constants rather
     * than rebuilding the array at each use, so those spellings are read too:
     * CHAIN for a chain chosen per form, ROUND for a form the same people
     * approve more than once.
     */
    private function chains(string $source): array
    {
        preg_match_all('/(?:\$steps\s*=|\'steps\'\s*=>|STEPS\s*=|CHAIN[A-Z_]*\s*=|ROUND[A-Z_]*\s*=)\s*\[(.*?)\]/s', $source, $matches);

        $chains = [];
        foreach ($matches[1] as $body) {
            preg_match_all("/['\"]([a-z_]+)['\"]/", $body, $roles);
            $chain = array_values(array_diff($roles[1], self::NOT_SUBMITTED_HERE));
            if ($chain) {
                $chains[] = $chain;
            }
        }

        usort($chains, fn ($a, $b) => count($b) <=> count($a));

        return $chains;
    }

    /** The roles submit() dispatches on. */
    private function acceptedRoles(string $source): array
    {
        if (!preg_match('/public function submit\b.*?\n    \}/s', $source, $m)) {
            return [];
        }

        preg_match_all("/case '([a-z_]+)':/", $m[0], $cases);

        return $cases[1];
    }

    /**
     * @dataProvider forms
     */
    public function test_every_role_in_the_chain_can_submit(string $type): void
    {
        $source = $this->source(self::FORMS[$type]);
        $chains = $this->chains($source);

        $this->assertNotEmpty($chains, $type . ' builds no chain this test can read');

        $accepted = $this->acceptedRoles($source);
        $this->assertNotEmpty($accepted, $type . ' has no submit() switch');

        foreach ($chains as $chain) {
            foreach ($chain as $role) {
                $this->assertContains(
                    $role,
                    $accepted,
                    sprintf(
                        '%s: a form reaches "%s" and stops. submit() has no branch for it, '
                        . 'so submitForm() refuses the only role that could move it on.',
                        $type,
                        $role
                    )
                );
            }
        }
    }

    /**
     * Where a step hands the form on, and where it sends it back.
     *
     * submitForm($user, $request, $id, $model, $role, $previousLevel, $nextLevel)
     * writes one of those two into `stage` and then refuses anyone who is not
     * that role. So both have to be a role the switch handles, or the form stops
     * on a stage nobody can act on.
     *
     * IRB Constitution did exactly that: its chain is student, faculty, hod,
     * adordc, dordc, and adordcSubmit sent a rejection back to 'dra', which is
     * in neither the chain nor the switch. Every rejection at the ADORDC parked
     * the form on a dead stage for good.
     *
     * @dataProvider forms
     */
    public function test_every_step_hands_the_form_somewhere_reachable(string $type): void
    {
        $source = $this->source(self::FORMS[$type]);
        $accepted = array_merge($this->acceptedRoles($source), ['complete']);

        preg_match_all(
            '/submitForm\(\s*\$user,\s*\$request,\s*\$form_id,\s*[^,]+,\s*'
            . "'(?<role>[a-z_]+)',\s*'(?<back>[a-z_]+)',\s*'(?<next>[a-z_]+)'/s",
            $source,
            $calls,
            PREG_SET_ORDER
        );

        if (!$calls) {
            // A controller that works its neighbours out from a chain rather
            // than writing the triple at each call site has nothing here to
            // read. Synopsis Submission is one: the same people approve twice,
            // in a different order each round, so the order lives in ROUND_ONE
            // and ROUND_TWO and submitAs() looks the neighbours up in them.
            //
            // Every name it can produce comes from those arrays, and
            // test_every_role_in_the_chain_can_submit already checks each of
            // them against the switch, so the guarantee still holds.
            $this->assertNotEmpty(
                $this->chains($source),
                $type . ': neither a submitForm triple nor a chain this test can read'
            );

            return;
        }

        foreach ($calls as $call) {
            foreach (['back' => 'sends a rejection to', 'next' => 'hands an approval to'] as $key => $what) {
                $target = $call[$key];
                if (in_array($target, self::NOT_SUBMITTED_HERE, true)) {
                    continue;
                }
                $this->assertContains(
                    $target,
                    $accepted,
                    sprintf(
                        '%s: the "%s" step %s "%s", which submit() has no branch for. '
                        . 'The form would stop there permanently.',
                        $type,
                        $call['role'],
                        $what,
                        $target
                    )
                );
            }
        }
    }

    /**
     * @dataProvider forms
     */
    public function test_a_branch_exists_for_every_case_it_dispatches(string $type): void
    {
        $controller = self::FORMS[$type];
        $source = $this->source($controller);

        preg_match('/public function submit\b.*?\n    \}/s', $source, $m);
        preg_match_all('/\$this->(\w+)\(/', $m[0] ?? '', $calls);

        $reflection = new ReflectionClass($controller);
        foreach (array_unique($calls[1] ?? []) as $method) {
            $this->assertTrue(
                $reflection->hasMethod($method),
                $type . ': submit() dispatches to ' . $method . '(), which does not exist',
            );
        }
    }

    public function test_the_form_endpoints_are_registered(): void
    {
        $submit = collect(Route::getRoutes())->filter(
            fn ($route) => str_contains($route->uri(), 'forms/') && in_array('POST', $route->methods(), true)
        );

        $this->assertNotEmpty($submit, 'no form submission routes are registered at all');
    }

    public function test_the_shared_submitter_still_gates_on_stage(): void
    {
        // The guard every form leans on: whoever is acting has to be the role the
        // form is parked at. Without it a role further down the chain could
        // approve a form still sitting with an earlier one.
        $trait = (new ReflectionMethod(GeneralFormSubmitter::class, 'submitForm'))->getFileName();
        $source = file_get_contents($trait);

        $this->assertStringContainsString('$expected = $formInstance->stage', $source);
        $this->assertStringContainsString("\$acting = \$role === 'faculty' ? 'supervisor' : \$role", $source);
        $this->assertStringContainsString('$expected !== $acting', $source);
    }
}
