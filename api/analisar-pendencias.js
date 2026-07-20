const MAX_BODY_BYTES = 32 * 1024;
const requestsByIp = new Map();

function cors(req, res) {
  const allowed = process.env.ALLOWED_ORIGIN;
  const origin = req.headers.origin || '';
  if (allowed && origin === allowed) res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'desconhecido').split(',')[0].trim();
}

function canUseToday(ip) {
  const today = new Date().toISOString().slice(0, 10);
  const limit = Math.max(1, Number(process.env.MAX_REQUESTS_PER_DAY || 30));
  const current = requestsByIp.get(ip);
  if (!current || current.day !== today) {
    requestsByIp.set(ip, { day: today, total: 1 });
    return true;
  }
  if (current.total >= limit) return false;
  current.total += 1;
  return true;
}

function normalizarPendencias(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.slice(0, 40).map((p) => ({
    prioridade: p?.nivel === 'critica' ? 'crítica' : 'atenção',
    titulo: String(p?.titulo || '').slice(0, 220),
    detalhe: String(p?.detalhe || '').slice(0, 500)
  })).filter((p) => p.titulo);
}

function extrairTexto(data) {
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim() || '';
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ sucesso: false, erro: 'Método não permitido.' });
  if (process.env.ALLOWED_ORIGIN && req.headers.origin !== process.env.ALLOWED_ORIGIN) {
    return res.status(403).json({ sucesso: false, erro: 'Origem não autorizada.' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ sucesso: false, erro: 'IA ainda não configurada no servidor.' });
  }
  if (Number(req.headers['content-length'] || 0) > MAX_BODY_BYTES) {
    return res.status(413).json({ sucesso: false, erro: 'Conteúdo muito grande.' });
  }
  if (!canUseToday(getIp(req))) {
    return res.status(429).json({ sucesso: false, erro: 'Limite diário de análises atingido. Tente amanhã.' });
  }

  const pendencias = normalizarPendencias(req.body?.pendencias);
  if (!pendencias.length) return res.status(400).json({ sucesso: false, erro: 'Nenhuma pendência válida para analisar.' });

  const instrucao = `Você é um assistente de operações industriais da SL Óleos. Analise APENAS a lista resumida abaixo. Não invente dados, não sugira ações automáticas e não dê instruções perigosas. Responda em português do Brasil, de forma curta e prática. Para cada situação, indique: prioridade, por que merece atenção e uma próxima ação humana sugerida. Se os dados não forem suficientes, diga isso claramente. Não mencione que é uma IA.\n\nPendências:\n${JSON.stringify(pendencias)}`;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: instrucao }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 900 }
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini error:', response.status, data?.error?.message || 'erro');
      return res.status(502).json({ sucesso: false, erro: 'Não foi possível consultar a IA agora. A Central continua disponível.' });
    }
    const analise = extrairTexto(data);
    if (!analise) return res.status(502).json({ sucesso: false, erro: 'A IA não retornou uma análise válida.' });
    return res.status(200).json({ sucesso: true, analise });
  } catch (error) {
    console.error('AI backend error:', error?.message || error);
    return res.status(502).json({ sucesso: false, erro: 'Falha de conexão com a IA. Tente novamente.' });
  }
}
