<?php

namespace App\Support;

/** Amounts in rupees, written the way the portal writes them. */
final class Rupees
{
    /** Grouped the Indian way: 48,50,000. */
    public static function grouped(int $amount): string
    {
        $sign = $amount < 0 ? '-' : '';
        $digits = (string) abs($amount);
        if (strlen($digits) <= 3) {
            return $sign . $digits;
        }
        $rest = substr($digits, 0, -3);
        return $sign . strrev(implode(',', str_split(strrev($rest), 2))) . ',' . substr($digits, -3);
    }

    /** ₹48.50 L, ₹1.20 Cr, or the grouped figure below a lakh. */
    public static function short(mixed $amount): string
    {
        $value = is_numeric($amount) ? (float) $amount : 0.0;
        if ($value >= 10000000) {
            return '₹' . number_format($value / 10000000, 2, '.', '') . ' Cr';
        }
        if ($value >= 100000) {
            return '₹' . number_format($value / 100000, 2, '.', '') . ' L';
        }
        return '₹' . self::grouped((int) $value);
    }
}
