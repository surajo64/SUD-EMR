const Visit = require('../models/visitModel');

/**
 * Checks if a patient currently has an active, non-discharged Inpatient admission.
 * @param {String|Object} patientId 
 * @param {Object} [visitDoc] Optional existing visit document
 * @returns {Promise<Boolean>}
 */
const isPatientAdmitted = async (patientId, visitDoc = null) => {
    // 1. Check if an explicit visit document was passed and is active inpatient
    if (visitDoc && (
        visitDoc.type === 'Inpatient' ||
        visitDoc.encounterType === 'Inpatient' ||
        visitDoc.encounterStatus === 'admitted' ||
        visitDoc.encounterStatus === 'in_ward' ||
        visitDoc.status === 'Admitted'
    ) && visitDoc.encounterStatus !== 'discharged' && visitDoc.status !== 'Discharged') {
        return true;
    }

    if (!patientId) return false;

    // 2. Query Visit collection for active admitted encounter for this patient
    const activeAdmittedVisit = await Visit.findOne({
        patient: patientId,
        $or: [
            { type: 'Inpatient' },
            { encounterType: 'Inpatient' },
            { encounterStatus: { $in: ['admitted', 'in_ward'] } },
            { status: 'Admitted' }
        ],
        encounterStatus: { $nin: ['discharged', 'cancelled', 'completed'] },
        status: { $ne: 'Discharged' }
    });

    return !!activeAdmittedVisit;
};

module.exports = { isPatientAdmitted };
