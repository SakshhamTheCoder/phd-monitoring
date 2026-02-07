/**
 * MigrationCommonFormFields
 * Ported from PHP: app/Models/Traits/MigrationCommonFormFields.php
 * 
 * This file documents the common fields used in form migrations.
 * In Sequelize, these fields are defined directly in models rather than migrations.
 * 
 * NOTE: Database migrations were excluded from scope per user request.
 * This file is provided for reference and documentation purposes.
 */

/**
 * Common field definitions for form tables
 * These match the PHP migration trait exactly
 */
export const commonFormMigrationFields = {
    id: {
        type: 'INTEGER',
        primaryKey: true,
        autoIncrement: true
    },
    student_id: {
        type: 'INTEGER',
        allowNull: false,
        references: { model: 'students', key: 'roll_no' },
        onDelete: 'CASCADE'
    },
    completion: {
        type: 'ENUM',
        values: ['incomplete', 'complete'],
        allowNull: true,
        defaultValue: 'incomplete'
    },
    status: {
        type: 'ENUM',
        values: ['draft', 'pending', 'approved', 'rejected'],
        allowNull: true,
        defaultValue: 'pending'
    },
    stage: {
        type: 'ENUM',
        values: ['student', 'hod', 'phd_coordinator', 'supervisor', 'doctoral', 'external', 'adordc', 'dordc', 'dra', 'director', 'complete'],
        allowNull: true,
        defaultValue: 'student'
    },
    history: { type: 'JSON', allowNull: true },
    steps: { type: 'JSON', allowNull: true },
    current_step: { type: 'INTEGER', allowNull: true, defaultValue: 0 },
    maximum_step: { type: 'INTEGER', allowNull: true, defaultValue: 0 },
    
    // Approval fields
    supervisor_approval: { type: 'BOOLEAN', allowNull: true, defaultValue: false },
    phd_coordinator_approval: { type: 'BOOLEAN', allowNull: true, defaultValue: false },
    hod_approval: { type: 'BOOLEAN', allowNull: true, defaultValue: false },
    dordc_approval: { type: 'BOOLEAN', allowNull: true, defaultValue: false },
    adordc_approval: { type: 'BOOLEAN', allowNull: true, defaultValue: false },
    dra_approval: { type: 'BOOLEAN', allowNull: true, defaultValue: false },
    director_approval: { type: 'BOOLEAN', allowNull: true, defaultValue: false },
    external_approval: { type: 'BOOLEAN', allowNull: true, defaultValue: false },
    doctoral_approval: { type: 'BOOLEAN', allowNull: true, defaultValue: false },
    
    // Lock fields
    student_lock: { type: 'BOOLEAN', allowNull: true, defaultValue: false },
    phd_coordinator_lock: { type: 'BOOLEAN', allowNull: true, defaultValue: true },
    hod_lock: { type: 'BOOLEAN', allowNull: true, defaultValue: true },
    supervisor_lock: { type: 'BOOLEAN', allowNull: true, defaultValue: true },
    dordc_lock: { type: 'BOOLEAN', allowNull: true, defaultValue: true },
    adordc_lock: { type: 'BOOLEAN', allowNull: true, defaultValue: true },
    dra_lock: { type: 'BOOLEAN', allowNull: true, defaultValue: true },
    director_lock: { type: 'BOOLEAN', allowNull: true, defaultValue: true },
    doctoral_lock: { type: 'BOOLEAN', allowNull: true, defaultValue: true },
    external_lock: { type: 'BOOLEAN', allowNull: true, defaultValue: true },
    
    // Comment fields
    student_comments: { type: 'TEXT', allowNull: true },
    phd_coordinator_comments: { type: 'TEXT', allowNull: true },
    hod_comments: { type: 'TEXT', allowNull: true },
    supervisor_comments: { type: 'TEXT', allowNull: true },
    dordc_comments: { type: 'TEXT', allowNull: true },
    adordc_comments: { type: 'TEXT', allowNull: true },
    dra_comments: { type: 'TEXT', allowNull: true },
    director_comments: { type: 'TEXT', allowNull: true },
    external_comments: { type: 'TEXT', allowNull: true },
    doctoral_comments: { type: 'TEXT', allowNull: true }
};

/**
 * Helper to get Sequelize DataTypes for common fields
 * @param {object} DataTypes - Sequelize DataTypes
 * @returns {object} Field definitions with proper DataTypes
 */
export const getCommonFieldsWithDataTypes = (DataTypes) => ({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    student_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    completion: {
        type: DataTypes.ENUM('incomplete', 'complete'),
        defaultValue: 'incomplete'
    },
    status: {
        type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected'),
        defaultValue: 'pending'
    },
    stage: {
        type: DataTypes.ENUM('student', 'hod', 'phd_coordinator', 'supervisor', 'doctoral', 'external', 'adordc', 'dordc', 'dra', 'director', 'complete'),
        defaultValue: 'student'
    },
    history: { type: DataTypes.JSON },
    steps: { type: DataTypes.JSON },
    current_step: { type: DataTypes.INTEGER, defaultValue: 0 },
    maximum_step: { type: DataTypes.INTEGER, defaultValue: 0 },
    
    // Approvals
    supervisor_approval: { type: DataTypes.BOOLEAN, defaultValue: false },
    phd_coordinator_approval: { type: DataTypes.BOOLEAN, defaultValue: false },
    hod_approval: { type: DataTypes.BOOLEAN, defaultValue: false },
    dordc_approval: { type: DataTypes.BOOLEAN, defaultValue: false },
    adordc_approval: { type: DataTypes.BOOLEAN, defaultValue: false },
    dra_approval: { type: DataTypes.BOOLEAN, defaultValue: false },
    director_approval: { type: DataTypes.BOOLEAN, defaultValue: false },
    external_approval: { type: DataTypes.BOOLEAN, defaultValue: false },
    doctoral_approval: { type: DataTypes.BOOLEAN, defaultValue: false },
    
    // Locks
    student_lock: { type: DataTypes.BOOLEAN, defaultValue: false },
    phd_coordinator_lock: { type: DataTypes.BOOLEAN, defaultValue: true },
    hod_lock: { type: DataTypes.BOOLEAN, defaultValue: true },
    supervisor_lock: { type: DataTypes.BOOLEAN, defaultValue: true },
    dordc_lock: { type: DataTypes.BOOLEAN, defaultValue: true },
    adordc_lock: { type: DataTypes.BOOLEAN, defaultValue: true },
    dra_lock: { type: DataTypes.BOOLEAN, defaultValue: true },
    director_lock: { type: DataTypes.BOOLEAN, defaultValue: true },
    doctoral_lock: { type: DataTypes.BOOLEAN, defaultValue: true },
    external_lock: { type: DataTypes.BOOLEAN, defaultValue: true },
    
    // Comments
    student_comments: { type: DataTypes.TEXT },
    phd_coordinator_comments: { type: DataTypes.TEXT },
    hod_comments: { type: DataTypes.TEXT },
    supervisor_comments: { type: DataTypes.TEXT },
    dordc_comments: { type: DataTypes.TEXT },
    adordc_comments: { type: DataTypes.TEXT },
    dra_comments: { type: DataTypes.TEXT },
    director_comments: { type: DataTypes.TEXT },
    external_comments: { type: DataTypes.TEXT },
    doctoral_comments: { type: DataTypes.TEXT }
});

export default {
    commonFormMigrationFields,
    getCommonFieldsWithDataTypes
};
