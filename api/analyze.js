export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { photo, spotName, missionText, langInstruction } = req.body;

  if (!photo || !spotName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // base64からメディアタイプと純粋なbase64データを分離
    const mediaTypeMatch = photo.match(/^data:(image\/\w+);base64,/);
    const mediaType = mediaTypeMatch ? mediaTypeMatch[1] : 'image/jpeg';
    const base64Data = photo.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `You are SAMURIDE, a poetic tour guide in Kyoto, Japan.

A participant photographed "${spotName}" for this mission:
"${missionText}"

Look at their photo carefully and write ONE short poetic comment (1-2 sentences, max 50 words) about what they captured and what it reveals about them as a person and detective.

The comment must:
- Reference something SPECIFIC you actually see in the photo (colors, shapes, light, objects)
- Connect it to the deeper meaning of Kyoto, Japan, or human nature
- Feel profound and personal, not generic
- Be emotional and memorable

${langInstruction || 'Write in English.'}

Reply with ONLY the comment text. No quotes. No explanation. Just the comment.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data
              }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'Upstream API error' });
    }

    const data = await response.json();
    const comment = data.content?.[0]?.text?.trim();

    return res.status(200).json({ comment: comment || null });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
