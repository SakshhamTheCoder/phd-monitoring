import { Model, DataTypes } from 'sequelize';
import sequelize from '../../database/connection.js';

class StudentBroadAreaSpecialization extends Model {
    static associate(models) {
        StudentBroadAreaSpecialization.belongsTo(models.Student, { foreignKey: 'student_id', targetKey: 'roll_no', as: 'student' });
        StudentBroadAreaSpecialization.belongsTo(models.BroadAreaSpecialization, { foreignKey: 'specialization_id', as: 'specialization' });
    }
}

StudentBroadAreaSpecialization.init({
    student_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    specialization_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    sequelize,
    modelName: 'StudentBroadAreaSpecialization',
    tableName: 'student_broad_area_specializations', // Inferred convention, verify if explicit in PHP (it wasn't)
    underscored: true,
});

export default StudentBroadAreaSpecialization;
