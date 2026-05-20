// api/salvar.js
// Esta função roda no Vercel e salva os dados da Meta no Google Sheets

export default async function handler(req, res) {
  // Permite apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  }

  const { waba_id, phone_number_id } = req.body;

  if (!waba_id || !phone_number_id) {
    return res.status(400).json({ ok: false, erro: 'Dados incompletos' });
  }

  try {
    // =====================================================
    // CONFIGURAÇÕES — PREENCHA COM SEUS DADOS
    // =====================================================
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;           // ID da sua planilha
    const SERVICE_ACCOUNT = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT); // JSON da conta de serviço
    // =====================================================

    // Gera token de acesso via Google Service Account
    const token = await getGoogleToken(SERVICE_ACCOUNT);

    // Data e hora do cadastro
    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    // Salva na aba "Conexoes" da planilha
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Conexoes!A:D:append?valueInputOption=USER_ENTERED`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [[agora, waba_id, phone_number_id, 'ATIVO']]
      })
    });

    if (!response.ok) {
      const erro = await response.text();
      console.error('Erro Sheets:', erro);
      return res.status(500).json({ ok: false, erro: 'Falha ao salvar na planilha' });
    }

    return res.status(200).json({ ok: true, mensagem: 'Dados salvos com sucesso' });

  } catch (err) {
    console.error('Erro interno:', err);
    return res.status(500).json({ ok: false, erro: 'Erro interno do servidor' });
  }
}

// Gera token OAuth2 para Google APIs usando Service Account
async function getGoogleToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);

  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }));

  // Assina o JWT com a chave privada
  const privateKey = serviceAccount.private_key;
  const signInput = `${header}.${payload}`;

  const keyData = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyData, new TextEncoder().encode(signInput));
  const jwt = `${signInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const tokenData = await tokenResp.json();
  return tokenData.access_token;
}

function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buffer;
}
