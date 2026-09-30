<?php

namespace App\Http\Middleware;

use Closure;

/**
 * A JSON number where the rules ask for text.
 *
 * An edit screen fills its fields from the API and sends back what the API gave
 * it, so a column stored as an integer comes back as a JSON number and a
 * `required|string` rule refuses the save: "The faculty code field must be a
 * string." The same happens to a scholar's registration number and to every
 * other numeric column behind a text field. Nothing is wrong with the value,
 * only with its type on the way in, so it is settled here rather than in each
 * rule that meets one.
 *
 * Numeric rules are unaffected: integer, numeric and digits all read "1001092"
 * as the number it is, and a size comparison still uses the number whenever the
 * rules say the field is one. A form post never reaches here with a number,
 * since multipart and urlencoded bodies carry only strings to begin with.
 */
class NumbersAsText
{
    public function handle($request, Closure $next)
    {
        $request->merge(self::text($request->input()));

        return $next($request);
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private static function text(array $input): array
    {
        foreach ($input as $key => $value) {
            if (is_int($value) || is_float($value)) {
                $input[$key] = (string) $value;
            } elseif (is_array($value)) {
                $input[$key] = self::text($value);
            }
        }

        return $input;
    }
}
