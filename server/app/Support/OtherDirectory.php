<?php

namespace App\Support;

use App\Models\Faculty;
use App\Models\OutsideExpert;
use App\Models\User;

/**
 * The portal keeps two records of people from outside the institute, and they
 * are not the same record.
 *
 * A supervisor who guides from another institute is faculty: they sign in, they
 * hold a supervisor or doctoral committee seat, and they are on the faculty
 * list. An outside expert signs in nowhere; they answer one tokened link for a
 * scholar's IRB, and they are on the outside experts list. The same person can
 * genuinely be both, so neither address is refused because of the other. What
 * was missing is the office being told, at the moment they add the second one,
 * that the first exists, which is the difference between a deliberate pair of
 * records and a duplicate nobody meant to make.
 */
class OtherDirectory
{
    /** Said when a faculty record is made for somebody already an outside expert. */
    public static function expertNamed(?string $email): ?string
    {
        $expert = self::expert($email);

        if (!$expert) {
            return null;
        }

        $name = trim($expert->first_name . ' ' . $expert->last_name);

        return "{$name} is already an outside expert at {$expert->institution}. "
            . 'Both records are kept: an outside expert cannot hold a supervisor seat, and faculty cannot be picked as the IRB external expert.';
    }

    /** Said when an outside expert is made for somebody already on the faculty. */
    public static function facultyNamed(?string $email): ?string
    {
        $faculty = self::faculty($email);

        if (!$faculty) {
            return null;
        }

        $where = $faculty->type === 'external'
            ? "an outside supervisor from {$faculty->institution}"
            : 'on the institute\'s faculty';

        return trim($faculty->user?->name() . " is already {$where}. ")
            . 'Both records are kept: only an outside expert can be picked as a scholar\'s IRB external expert.';
    }

    private static function expert(?string $email): ?OutsideExpert
    {
        $email = strtolower(trim((string) $email));

        return $email === '' ? null : OutsideExpert::whereRaw('LOWER(email) = ?', [$email])->first();
    }

    private static function faculty(?string $email): ?Faculty
    {
        $email = strtolower(trim((string) $email));

        if ($email === '') {
            return null;
        }

        $userId = User::whereRaw('LOWER(email) = ?', [$email])->value('id');

        return $userId ? Faculty::with('user')->where('user_id', $userId)->first() : null;
    }
}
