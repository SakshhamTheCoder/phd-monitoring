<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Uploads are written by the web server and by the deploy, as two users in one
 * group. A private folder made by either must stay open to the other, or the
 * files in it read as missing.
 */
class UploadFoldersOpenToTheirGroupTest extends TestCase
{
    /** The modes the disk is built with, read the way Laravel reads them. */
    public function test_the_local_disk_makes_private_folders_open_to_their_group(): void
    {
        $modes = \League\Flysystem\UnixVisibility\PortableVisibilityConverter::fromArray(
            config('filesystems.disks.local.permissions')
        );

        $this->assertSame(0770, $modes->forDirectory('private'));
        $this->assertSame(0644, $modes->forFile('private'));
    }

    public function test_a_private_upload_folder_is_open_to_its_group(): void
    {
        if (PHP_OS_FAMILY === 'Windows') {
            $this->markTestSkipped('Windows does not keep Unix permissions.');
        }

        $disk = Storage::disk('local');
        $path = 'uploads/permission-probe-' . uniqid() . '/file.pdf';
        $disk->put($path, '%PDF-1.4', 'private');

        try {
            $this->assertSame('0770', substr(sprintf('%o', fileperms(dirname($disk->path($path)))), -4));
            $this->assertSame('0644', substr(sprintf('%o', fileperms($disk->path($path))), -4));
        } finally {
            $disk->deleteDirectory(dirname($path));
        }
    }
}
