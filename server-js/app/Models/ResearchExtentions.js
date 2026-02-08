import { Model, DataTypes } from 'sequelize';
import sequelize from '../../database/connection.js';

class ResearchExtentions extends Model {

    async researchExtentionsForm() {
        return await this.getResearchExtentionsForm();
    }

    static associate(models) {
        ResearchExtentions.belongsTo(models.ResearchExtentionsForm, { foreignKey: 'research_extentions_id', as: 'researchExtentionsForm' });
        ResearchExtentions.belongsTo(models.Student, { foreignKey: 'student_id', targetKey: 'roll_no', as: 'student' });
    }
}

ResearchExtentions.init({
    research_extentions_id: DataTypes.INTEGER,
    student_id: DataTypes.STRING,
    period_of_extension: DataTypes.STRING,
    research_pdf: DataTypes.STRING,
    reason: DataTypes.TEXT,
}, {
    sequelize,
    modelName: 'ResearchExtentions',
    tableName: 'research_extentions',
    underscored: true,
});

export default ResearchExtentions;
