const Appointment = require('../models/Appointment');
const State = require('../models/State');

const getStateCooldownBlock = async ({ patientId, stateCode }) => {
  if (!patientId || !stateCode) return null;

  const normalizedState = stateCode.toString().trim().toUpperCase();
  if (!normalizedState) return null;

  const stateConfig = await State.findOne({
    $or: [
      { code: normalizedState },
      { abbreviation: normalizedState }
    ]
  }).select('cooldownMonths name');

  if (!stateConfig || !stateConfig.cooldownMonths || stateConfig.cooldownMonths <= 0) {
    return null;
  }

  const lastCompleted = await Appointment.findOne({
    patient_id: patientId,
    state: { $regex: new RegExp(`^${normalizedState}$`, 'i') },
    status: 'completed'
  }).sort({ completedAt: -1, updatedAt: -1, scheduledDate: -1 });

  if (!lastCompleted) return null;

  const completionDate =
    lastCompleted.completedAt || lastCompleted.updatedAt || lastCompleted.scheduledDate;

  if (!completionDate) return null;

  const eligibleDate = new Date(completionDate);
  eligibleDate.setMonth(eligibleDate.getMonth() + stateConfig.cooldownMonths);

  if (new Date() < eligibleDate) {
    const month = String(eligibleDate.getMonth() + 1).padStart(2, '0');
    const day = String(eligibleDate.getDate()).padStart(2, '0');
    const year = eligibleDate.getFullYear();
    const eligibleDateFormatted = `${month}/${day}/${year}`;
    return {
      eligibleDate,
      eligibleDateFormatted,
      cooldownMonths: stateConfig.cooldownMonths,
      stateName: stateConfig.name || normalizedState
    };
  }

  return null;
};

module.exports = { getStateCooldownBlock };
