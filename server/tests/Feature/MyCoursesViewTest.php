<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Pages\MyCoursesPage;
use Tests\TestCase;

/** A scholar's own courses, taking and finished. */
class MyCoursesViewTest extends TestCase
{
    private function reader(string $role): User
    {
        $user = new User();
        $user->setRelation('current_role', new Role(['role' => $role]));
        return $user;
    }

    public function test_only_a_scholar_reads_their_courses(): void
    {
        $this->assertTrue((new MyCoursesPage())->allows($this->reader('student')));
        $this->assertFalse((new MyCoursesPage())->allows($this->reader('faculty')));
    }

    public function test_each_tab_reads_its_own_courses_and_only_finished_ones_show_a_grade(): void
    {
        [$ongoing, $past] = (new MyCoursesPage())->view($this->reader('student'))['tabs'];

        $this->assertSame('/courses/student/my-courses?status=enrolled', $ongoing['table']['endpoint']);
        $this->assertSame('/courses/student/my-courses?status=completed', $past['table']['endpoint']);
        $this->assertNotContains('grade', array_column($ongoing['table']['columns'], 'key'));
        $this->assertContains('grade', array_column($past['table']['columns'], 'key'));
    }
}
