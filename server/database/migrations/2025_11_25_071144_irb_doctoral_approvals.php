<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('irb_doctoral_approvals', function (Blueprint $table) {
            $table->increments('id');
            $table->primary('id');
            $table->integer('irb_sub_form_id')->unsigned()->index();
            $table->foreign('irb_sub_form_id')->references('id')->on('irb_sub_forms')->onDelete('cascade');
            $table->integer('doctoral_id')->unsigned()->index();
            $table->foreign('doctoral_id')->references('faculty_code')->on('faculty')->onDelete('cascade');
            // App creates these rows with 'pending' (IrbSubForm) then updates to 'approved'.
            // 'pending' must be in the enum — matches the real/prod schema.
            $table->enum('status',['pending','approved','rejected']);
            $table->unique(['irb_sub_form_id','doctoral_id'],'uiniqe_approval');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('irb_doctoral_approvals');
    }
};
