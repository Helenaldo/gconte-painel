import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { processId, processTitle, clientName, to, includePdf, pdfDataUri } = await req.json();

    const toEmails: string[] = [];
    // Neste exemplo simples, apenas envia para um e-mail de testes se não configurado
    // Em produção, você pode buscar o e-mail do responsável e do cliente no banco.
    if (to === "responsavel") {
      // Placeholder: envie para um endereço fixo se não tiver integração ainda
      toEmails.push("responsavel@example.com");
    }

    const attachments = [] as any[];
    if (includePdf && pdfDataUri && typeof pdfDataUri === "string") {
      const base64 = pdfDataUri.split(",")[1] || pdfDataUri; // data:application/pdf;base64,... | data:image/png;base64,...
      attachments.push({ filename: `encerramento-${processId}.pdf`, content: base64 });
    }

    const { error } = await resend.emails.send({
      from: "GConte <no-reply@gconte.app>",
      to: toEmails,
      subject: `Processo concluído: ${processTitle}`,
      html: `<p>O processo <strong>${processTitle}</strong>${clientName ? ` do cliente <strong>${clientName}</strong>` : ""} foi concluído.</p>
             <p><a href="${req.headers.get("origin") || ""}/processos/${processId}">Abrir no sistema</a></p>`,
      attachments,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
