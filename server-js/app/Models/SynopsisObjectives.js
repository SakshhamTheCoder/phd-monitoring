import { Model, DataTypes } from 'sequelize';
import sequelize from '../../database/connection.js';

class SynopsisObjectives extends Model {
    static associate(models) {
        SynopsisObjectives.belongsTo(models.SynopsisSubmission, { foreignKey: 'synopsis_id', as: 'synopsisSubmission' });
    }
}

SynopsisObjectives.init({
    synopsis_id: DataTypes.INTEGER,
    objective: DataTypes.TEXT,
}, {
    sequelize,
    modelName: 'SynopsisObjectives',
    tableName: 'synopsis_objectives',
    underscored: true,
});

export default SynopsisObjectives;
