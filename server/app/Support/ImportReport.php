<?php

namespace App\Support;

/**
 * A single-request import can return hundreds of row errors, and the client
 * turns every entry in `messages` into its own toast, some sticky for ten
 * seconds. That buried the one summary line the reader actually needs under
 * a wall of toasts. This keeps a handful of errors readable and folds
 * whatever is left into one counted line.
 */
class ImportReport
{
    private const MAX_NAMED_ERRORS = 3;

    /**
     * @param  array<int, array{tone: string, text: string}>  $messages  What the import already wants to say, in order.
     * @param  array<int, string>  $errors  Every row error, unabridged. The full list still goes back in `data`.
     * @return array<int, array{tone: string, text: string, sticky?: bool}>
     */
    public static function withRowErrors(array $messages, array $errors, bool $sticky = false): array
    {
        $named = array_slice($errors, 0, self::MAX_NAMED_ERRORS);
        $remaining = count($errors) - count($named);

        foreach ($named as $error) {
            $messages[] = self::line($error, $sticky);
        }

        if ($remaining > 0) {
            $text = $remaining === 1 ? '1 more row had an error' : "{$remaining} more rows had errors";
            $messages[] = self::line($text, $sticky);
        }

        return $messages;
    }

    private static function line(string $text, bool $sticky): array
    {
        $line = ['tone' => 'warn', 'text' => $text];
        if ($sticky) {
            $line['sticky'] = true;
        }

        return $line;
    }
}
