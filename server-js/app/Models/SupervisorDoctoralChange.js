import { Model, DataTypes } from 'sequelize';
import sequelize from '../../database/connection.js';

class SupervisorDoctoralChange extends Model {
    static associate(models) {
        SupervisorDoctoralChange.belongsTo(models.Student, { foreignKey: 'student_id', targetKey: 'roll_no', as: 'student' });
        SupervisorDoctoralChange.belongsTo(models.User, { foreignKey: 'requested_by', as: 'requester' });
        SupervisorDoctoralChange.belongsTo(models.User, { foreignKey: 'approved_by', as: 'approver' });
        SupervisorDoctoralChange.belongsTo(models.Faculty, { foreignKey: 'old_faculty_code', targetKey: 'faculty_code', as: 'oldFaculty' });
        SupervisorDoctoralChange.belongsTo(models.Faculty, { foreignKey: 'new_faculty_code', targetKey: 'faculty_code', as: 'newFaculty' });
        SupervisorDoctoralChange.belongsTo(models.OutsideExpert, { foreignKey: 'outside_expert_id', as: 'outsideExpert' });
    }
}

SupervisorDoctoralChange.init({
    student_id: DataTypes.STRING,
    change_type: DataTypes.STRING,
    member_type: DataTypes.STRING,
    faculty_type: DataTypes.STRING,
    old_faculty_code: DataTypes.STRING,
    new_faculty_code: DataTypes.STRING,
    outside_expert_id: DataTypes.INTEGER,
    reason: DataTypes.TEXT,
    status: DataTypes.STRING,
    requested_by: DataTypes.INTEGER,
    approved_by: DataTypes.INTEGER,
    approved_at: DataTypes.DATE,
    rejection_reason: DataTypes.TEXT,
}, {
    sequelize,
    modelName: 'SupervisorDoctoralChange',
    tableName: 'supervisor_doctoral_changes', // Assumed standard plural
    underscored: true,
});

export default SupervisorDoctoralChange;
