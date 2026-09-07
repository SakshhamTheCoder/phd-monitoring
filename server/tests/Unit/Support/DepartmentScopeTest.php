<?php

namespace Tests\Unit\Support;

use App\Support\DepartmentScope;
use Tests\TestCase;

class DepartmentScopeTest extends TestCase
{
    public function test_an_unrestricted_user_asking_for_nothing_gets_everything(): void
    {
        $this->assertSame(['ids' => null, 'denied' => false], DepartmentScope::resolve(null, null));
    }

    public function test_an_unrestricted_user_may_ask_for_any_single_department(): void
    {
        $this->assertSame(['ids' => [7], 'denied' => false], DepartmentScope::resolve(null, 7));
    }

    public function test_a_scoped_user_asking_for_nothing_gets_their_own_departments(): void
    {
        $this->assertSame(['ids' => [3, 4], 'denied' => false], DepartmentScope::resolve([3, 4], null));
    }

    public function test_a_scoped_user_may_narrow_to_one_of_their_own(): void
    {
        $this->assertSame(['ids' => [4], 'denied' => false], DepartmentScope::resolve([3, 4], 4));
    }

    public function test_a_scoped_user_asking_for_someone_elses_department_is_denied(): void
    {
        $this->assertSame(['ids' => [], 'denied' => true], DepartmentScope::resolve([3, 4], 9));
    }

    public function test_a_scoped_user_with_no_departments_at_all_is_denied(): void
    {
        $this->assertSame(['ids' => [], 'denied' => true], DepartmentScope::resolve([], null));
        $this->assertSame(['ids' => [], 'denied' => true], DepartmentScope::resolve([], 3));
    }

    public function test_a_requested_id_is_coerced_from_a_string(): void
    {
        $this->assertSame(['ids' => [4], 'denied' => false], DepartmentScope::resolve([3, 4], '4'));
    }

    public function test_a_blank_request_is_treated_as_no_request(): void
    {
        $this->assertSame(['ids' => [3, 4], 'denied' => false], DepartmentScope::resolve([3, 4], ''));
        $this->assertSame(['ids' => null, 'denied' => false], DepartmentScope::resolve(null, ''));
    }
}
