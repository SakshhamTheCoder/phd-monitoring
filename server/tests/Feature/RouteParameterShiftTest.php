<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Laravel fills a controller's scalar arguments in route order. A nested route
 * carries more parameters than a flat one, so a method written for the flat
 * path receives the wrong values on the nested one: every form under
 * /students/{id}/forms/... answered "No form found" because the scholar's roll
 * number arrived where the form id was expected.
 *
 * A method that takes fewer scalar arguments than its route has parameters must
 * therefore read what it needs by name.
 */
class RouteParameterShiftTest extends TestCase
{
    public function test_no_controller_reads_a_nested_route_by_position(): void
    {
        $offenders = [];

        foreach (Route::getRoutes() as $route) {
            $action = $route->getActionName();
            if (!str_contains($action, '@')) {
                continue;
            }

            [$class, $method] = explode('@', $action);
            if (!class_exists($class) || !method_exists($class, $method)) {
                continue;
            }

            preg_match_all('/\{(\w+)\??\}/', $route->uri(), $matches);
            $parameters = $matches[1];

            $reflection = new ReflectionMethod($class, $method);
            $arguments = [];
            foreach ($reflection->getParameters() as $parameter) {
                $type = $parameter->getType();
                if ($type && !$type->isBuiltin()) {
                    continue;
                }
                $arguments[] = $parameter->getName();
            }

            // A method taking no scalar arguments reads nothing by position,
            // so there is nothing for the extra parameter to shift.
            if ($arguments === [] || count($parameters) <= count($arguments)) {
                continue;
            }

            $name = class_basename($class) . '@' . $method;

            $source = implode('', array_slice(
                file($reflection->getFileName()),
                $reflection->getStartLine() - 1,
                $reflection->getEndLine() - $reflection->getStartLine() + 1
            ));

            if (!str_contains($source, 'routeParam')) {
                $offenders[] = $name . '  (' . $route->uri() . ')';
            }
        }

        $this->assertSame([], array_values(array_unique($offenders)));
    }
}
