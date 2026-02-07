import { Model, DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

/**
 * ThesisExtension Model
 * Ported from PHP Laravel's App\Models\ThesisExtension
 * 
 * Tracks thesis extension records for students
 */
class ThesisExtension extends Model {
    /**
     * Association definitions
     */
    static associate(models) {
        ThesisExtension.belongsTo(models.Student, { 
            foreignKey: 'student_id', 
            targetKey: 'roll_no', 
            as: 'student' 
        });
    }
}

ThesisExtension.init({
    student_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    period_of_extention: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    form_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'ThesisExtension',
    tableName: 'thesis_extentions',
    underscored: true,
});

export default ThesisExtension;
