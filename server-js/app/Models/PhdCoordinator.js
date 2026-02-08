import { Model, DataTypes } from 'sequelize';
import sequelize from '../../database/connection.js';

class PhdCoordinator extends Model {
    /**
     * The attributes that should be hidden for arrays.
     */
    toJSON() {
        const values = Object.assign({}, this.get());
        delete values['created_at'];
        delete values['updated_at'];
        return values;
    }

    static associate(models) {
        PhdCoordinator.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
        PhdCoordinator.belongsTo(models.Faculty, { foreignKey: 'faculty_id', targetKey: 'faculty_code', as: 'faculty' });
    }
}

PhdCoordinator.init({
    department_id: DataTypes.INTEGER,
    faculty_id: DataTypes.STRING, // faculty_code usually string
}, {
    sequelize,
    modelName: 'PhdCoordinator',
    tableName: 'phd_coordinators', // inferred standard plural
    underscored: true,
});

export default PhdCoordinator;
