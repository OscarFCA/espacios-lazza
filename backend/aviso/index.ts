// Legato Capital — aviso al equipo cuando alguien escribe.
//
// Supabase Edge Function (Deno). Se despliega así, una sola vez:
//
//   supabase functions deploy aviso --project-ref wmrtzwugmxlugqtzqujo
//   supabase secrets set SENDGRID_API_KEY=SG.xxxxx --project-ref wmrtzwugmxlugqtzqujo
//   supabase secrets set AVISO_PARA=info@lazza.com.mx
//   supabase secrets set AVISO_DE=avisos@lazza.com.mx
//
// Por qué vive aquí y no en el navegador: la llave de SendGrid es secreta. Si
// estuviera en el sitio, cualquiera que abriera el código podría mandar correo
// en nombre de Lazza. Aquí la guarda Supabase y nunca sale.
//
// El sitio la llama con la llave anon, que es pública y está pensada para eso.
// Lo que impide que alguien la use para hacer spam no es esconderla: es que
// esta función SOLO sabe escribirle al equipo. No acepta destinatario.

const SENDGRID = Deno.env.get("SENDGRID_API_KEY") ?? "";
const PARA     = Deno.env.get("AVISO_PARA") ?? "info@lazza.com.mx";
const DE       = Deno.env.get("AVISO_DE")   ?? "avisos@lazza.com.mx";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function limpio(v: unknown, tope = 500): string {
  return String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, tope);
}
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Método no permitido", { status: 405, headers: CORS });
  }

  let d: Record<string, unknown>;
  try { d = await req.json(); }
  catch { return new Response("Cuerpo ilegible", { status: 400, headers: CORS }); }

  // Lo que el sitio manda. Nada de esto decide a dónde va el correo.
  const nombre = limpio(d.nombre, 120) || "Alguien";
  const correo = limpio(d.correo, 160);
  const tel    = limpio(d.telefono, 40);
  const tipo   = d.tipo === "visita" ? "visita" : "mensaje";
  const texto  = limpio(d.texto, 2000);
  const prop   = limpio(d.propiedad, 160);
  const cuando = limpio(d.cuando, 80);

  const asunto = tipo === "visita"
    ? `Visita solicitada · ${nombre}`
    : `Mensaje nuevo · ${nombre}`;

  const lineas = [
    ["Quién", nombre],
    ["Correo", correo],
    ["Teléfono", tel],
    ["Propiedad", prop],
    ["Cuándo pide la visita", cuando],
  ].filter(([, v]) => v);

  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px">` +
    `<h2 style="font-weight:600;margin:0 0 4px">${esc(asunto)}</h2>` +
    `<p style="color:#666;margin:0 0 20px;font-size:14px">Legato Capital · aviso automático del sitio</p>` +
    `<table style="border-collapse:collapse;width:100%;font-size:15px">` +
    lineas.map(([k, v]) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;white-space:nowrap">${esc(k)}</td>` +
      `<td style="padding:6px 0"><strong>${esc(v)}</strong></td></tr>`).join("") +
    `</table>` +
    (texto
      ? `<p style="margin:20px 0 6px;color:#666;font-size:14px">Lo que escribió</p>` +
        `<blockquote style="margin:0;padding:12px 16px;background:#f5f3ee;border-radius:8px;` +
        `font-size:15px;line-height:1.5">${esc(texto)}</blockquote>`
      : "") +
    `<p style="margin-top:24px;font-size:14px">` +
    `<a href="https://oscarfca.github.io/espacios-lazza/#/perfil/interesados">Abrir el tablero</a></p>` +
    `</div>`;

  if (!SENDGRID) {
    // Sin llave no se finge que se mandó: se dice.
    return new Response(JSON.stringify({ ok: false, motivo: "sin-llave" }),
      { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + SENDGRID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: PARA }],
        // Contestar al correo lleva directo al interesado, no a la función.
        ...(correo ? { reply_to: { email: correo, name: nombre } } : {}),
      }],
      from: { email: DE, name: "Legato Capital" },
      subject: asunto,
      content: [{ type: "text/html", value: html }],
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    console.error("SendGrid respondió", r.status, t.slice(0, 300));
    return new Response(JSON.stringify({ ok: false, estado: r.status }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true }),
    { headers: { ...CORS, "Content-Type": "application/json" } });
});
