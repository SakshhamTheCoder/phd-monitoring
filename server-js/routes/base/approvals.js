// Ported from Laravel's routes/base/approvals.php
import { Router } from 'express';
import { Approval } from '../../app/Models/Approval.js';

const router = Router();

router.get('/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const action = req.query.action;

        const approval = await Approval.findOne({ where: { key } });

        if (!approval) {
            return res.status(404).json({ message: 'Invalid approval key.' });
        }

        if (action === 'accept') {
            approval.approved = true;
        } else if (action === 'reject') {
            approval.approved = false;
        }
        await approval.save();

        const modelType = approval.model_type;

        // Dynamically resolve model from model_type string
        // In PHP this does `new $model`, here we need to map the model type to an actual class
        // The model_type string from PHP is like "App\\Models\\IrbSubForm"
        // We extract just the class name and try to import it
        const modelName = modelType.split('\\').pop();

        try {
            const modelModule = await import(`../../app/Models/${modelName}.js`);
            const ModelClass = modelModule[modelName] || modelModule.default;

            if (ModelClass && typeof ModelClass.handleApproval === 'function') {
                return await ModelClass.handleApproval(approval.email, approval.model_id, approval.approved);
            } else {
                // Try instance method
                const modelInstance = new ModelClass();
                if (typeof modelInstance.handleApproval === 'function') {
                    return await modelInstance.handleApproval(approval.email, approval.model_id, approval.approved);
                }
            }

            return res.status(500).json({
                message: `The method 'handleApproval' does not exist in model: ${modelType}`
            });
        } catch (importError) {
            console.error(`Failed to import model ${modelName}:`, importError);
            return res.status(500).json({
                message: `The method 'handleApproval' does not exist in model: ${modelType}`
            });
        }
    } catch (error) {
        console.error('Error processing approval:', error);
        return res.status(500).json({
            message: 'An error occurred: ' + error.message
        });
    }
});

export default router;
