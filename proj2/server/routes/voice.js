const express = require('express');
const axios = require('axios');

const router = express.Router();

const ACTIONS = [
  { id: 'logout', description: 'Log the user out' },
  { id: 'openProfile', description: 'Open the profile page' },
  { id: 'goHome', description: 'Go to the home screen' },
];

const ACTION_IDS = ACTIONS.map((action) => action.id);
const ACTION_SET = new Set(ACTION_IDS);

const buildPrompt = (userText) =>
  `You are an action classifier for our app.
The user said: ${userText}.
Choose EXACTLY ONE action from this list: [${ACTION_IDS.join(', ')}].
Respond ONLY with the action id.`;

router.post('/classify', async (req, res) => {
  try {
    const { userText } = req.body || {};

    if (!userText || typeof userText !== 'string') {
      return res.status(400).json({ error: 'userText is required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is missing.' });
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const apiVersion = process.env.GEMINI_API_VERSION || 'v1beta';
    const baseUrl = 'https://generativelanguage.googleapis.com';

    const url = `${baseUrl}/${apiVersion}/models/${model}:generateContent`;

    const response = await axios.post(
      url,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: buildPrompt(userText) }],
          },
        ],
      },
      {
        params: { key: apiKey },
      }
    );

    const actionId =
      response?.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!actionId || !ACTION_SET.has(actionId)) {
      return res
        .status(422)
        .json({ error: 'Unable to interpret Gemini response.', raw: actionId });
    }

    return res.json({ actionId });
  } catch (error) {
    console.error(
      'Gemini classification error:',
      error.response?.data || error.message
    );
    const status = error.response?.status || 500;
    return res.status(status).json({
      error: 'Gemini classification failed.',
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;
