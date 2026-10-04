// Genera la descripción de un aviso con IA (botón del admin).
// Función de Vercel: POST /api/ai  { detalles }
// Necesita la variable de entorno ANTHROPIC_API_KEY en Vercel.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const detalles = req.body && req.body.detalles;
  if (!detalles) return res.status(400).json({ error: 'Falta detalles' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Falta configurar ANTHROPIC_API_KEY en Vercel' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: 'Sos un experto en marketing inmobiliario argentino. Escribí una descripción atractiva y profesional para este aviso inmobiliario. Usá un tono cálido y persuasivo, en español argentino. No más de 4 párrafos. No uses asteriscos ni formato markdown. Estos son los datos:\n\n' + detalles,
        }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: (data.error && data.error.message) || 'Error de la IA' });
    const texto = data.content && data.content[0] ? data.content[0].text : '';
    return res.status(200).json({ texto });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
