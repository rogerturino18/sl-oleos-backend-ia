# Backend IA — SL Óleos

Backend independente para a Central de Pendências. Ele usa a Gemini API e não possui acesso ao certificado A1, ao backend de NF-e ou às credenciais do Supabase.

## Publicação na Vercel

1. Crie um novo repositório no GitHub chamado `sl-oleos-backend-ia`.
2. Envie **o conteúdo desta pasta** para esse novo repositório.
3. Na Vercel, crie um novo projeto importando esse repositório. Não altere o projeto `backend-nfe`.
4. Em **Settings → Environment Variables**, cadastre as variáveis de `.env.example`:
   - `GEMINI_API_KEY`: a chave criada no Google AI Studio (Sensitive).
   - `ALLOWED_ORIGIN`: URL pública do aplicativo no Cloudflare Workers, sem barra no fim.
   - `GEMINI_MODEL`: `gemini-2.5-flash`.
   - `MAX_REQUESTS_PER_DAY`: `30`.
5. Faça o deploy. A URL final terá este formato: `https://sl-oleos-backend-ia-....vercel.app`.
6. No aplicativo, abra Central de Pendências → **Análise IA** → Configurar, e cole somente a URL do backend.

## Proteções desta primeira versão

- A chave Gemini nunca é enviada ao navegador ou ao GitHub.
- Apenas a origem configurada em `ALLOWED_ORIGIN` pode fazer chamadas.
- Limite diário por IP e tamanho máximo da solicitação.
- A IA recebe somente o resumo das pendências já geradas no navegador.
- A IA é exclusivamente consultiva: não cria, edita ou exclui dados.

> O limite diário em função serverless é uma proteção operacional, mas não substitui autenticação robusta. Antes de liberar a ferramenta a muitos usuários, a próxima etapa é migrar o login do aplicativo para Supabase Auth.
