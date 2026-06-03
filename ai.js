// netlify/functions/ai.js
// Coloca este archivo en: netlify/functions/ai.js
// En Netlify, agregá la variable de entorno: ANTHROPIC_API_KEY = tu-api-key

export async function handler(event) {
  // Solo aceptar POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let detalles;
  try {
    const body = JSON.parse(event.body);
    detalles = body.detalles;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  if (!detalles) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta el campo detalles' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key no configurada' }) };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Sos un experto en marketing inmobiliario argentino. Escribí una descripción atractiva y profesional para este aviso inmobiliario. Usá un tono cálido y persuasivo, en español argentino. No más de 4 párrafos. No uses asteriscos ni formato markdown. Estos son los datos:\n\n${detalles}`
        }]
      })
    });

    const data = await response.json();
    const texto = data.content?.[0]?.text || '';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
