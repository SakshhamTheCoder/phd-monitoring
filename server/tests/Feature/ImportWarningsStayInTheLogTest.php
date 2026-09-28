<?php

namespace Tests\Feature;

use App\Http\Middleware\LogRequestResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * What an import says about the rows it could not take is read once, in a
 * dialog, and then gone. The log was the only copy, and the cap on large
 * successful responses replaced the list with a byte count.
 */
class ImportWarningsStayInTheLogTest extends TestCase
{
    private function logged(array $body, int $status = 200)
    {
        $written = null;
        \Illuminate\Support\Facades\Log::listen(function ($message) use (&$written) {
            if ($message->message === '📤 Outgoing Response') {
                $written = $message->context['content'];
            }
        });

        (new LogRequestResponse())->handle(
            Request::create('/api/students/bulk-upload', 'POST'),
            fn () => new JsonResponse($body, $status)
        );

        return $written;
    }

    private function rows(int $count): array
    {
        return array_map(
            fn ($index) => "Row {$index}: SQLSTATE[22007]: Invalid datetime value on a date the sheet left as text",
            range(2, $count + 1)
        );
    }

    public function test_a_long_list_of_refused_rows_is_written_out_in_full(): void
    {
        $logged = $this->logged([
            'success' => true,
            'data' => ['errors' => $this->rows(40)],
        ]);

        $this->assertIsArray($logged, 'the body should be logged, not summarised as a size');
        $this->assertCount(40, $logged['data']['errors']);
        $this->assertStringContainsString('SQLSTATE', $logged['data']['errors'][0]);
    }

    /** A long list page is still noted by size; that was the point of the cap. */
    public function test_a_long_answer_with_nothing_wrong_is_still_noted_by_size(): void
    {
        $logged = $this->logged([
            'success' => true,
            'data' => array_fill(0, 200, ['course_code' => 'UCH001', 'course_name' => 'Chemistry']),
        ]);

        $this->assertIsString($logged);
        $this->assertStringContainsString('bytes]', $logged);
    }

    public function test_an_import_that_refused_nothing_is_not_kept_whole_either(): void
    {
        $logged = $this->logged([
            'success' => true,
            'message' => str_repeat('imported ', 400),
            'data' => ['errors' => []],
        ]);

        $this->assertIsString($logged);
        $this->assertStringContainsString('bytes]', $logged);
    }
}
