<?php

namespace App\Support;

/** A row an import leaves out; the message says why, without the row number. */
class RowRejected extends \RuntimeException
{
}
