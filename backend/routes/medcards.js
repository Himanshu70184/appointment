const express = require('express');
const MedicalCard = require('../models/MedicalCard');

const router = express.Router();

// @route   GET /api/medcards
// @desc    Get all active medical card types
// @access  Public
router.get('/', async (req, res) => {
  try {
    const medicalCards = await MedicalCard.find({ isActive: true }).sort({ price: 1 });
    res.json({ medicalCards });
  } catch (error) {
    console.error('Get medical cards error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/medcards/:id
// @desc    Get medical card by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const medicalCard = await MedicalCard.findById(req.params.id);
    if (!medicalCard) {
      return res.status(404).json({ message: 'Medical card not found' });
    }
    res.json({ medicalCard });
  } catch (error) {
    console.error('Get medical card error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
