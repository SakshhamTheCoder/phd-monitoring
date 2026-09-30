<?php

namespace Tests\Unit;

use App\Http\Middleware\NumbersAsText;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class NumbersAsTextTest extends TestCase
{
    private function through(array $body): Request
    {
        $request = Request::create('/api/faculty/update/1001092', 'PUT', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode($body));

        return (new NumbersAsText())->handle($request, fn ($passed) => $passed);
    }

    public function test_a_number_the_edit_screen_sent_back_passes_a_string_rule(): void
    {
        $request = $this->through(['faculty_code' => 1001092, 'phone' => 9815601075]);

        $this->assertSame('1001092', $request->input('faculty_code'));
        $this->assertFalse(
            Validator::make($request->all(), ['faculty_code' => 'required|string'])->fails()
        );
    }

    public function test_numeric_rules_still_read_the_number(): void
    {
        $request = $this->through([
            'department_id' => 3,
            'cgpa' => 8.5,
            'areas' => ['ids' => [4, 5]],
            'send_invites' => true,
            'website_link' => null,
        ]);

        $this->assertFalse(Validator::make($request->all(), [
            'department_id' => 'required|integer|max:10',
            'cgpa' => 'required|numeric|max:10',
            'areas.ids.*' => 'integer',
        ])->fails());

        $this->assertSame('8.5', $request->input('cgpa'));
        $this->assertSame(['4', '5'], $request->input('areas.ids'));
        $this->assertTrue($request->input('send_invites'));
        $this->assertNull($request->input('website_link'));
    }
}
