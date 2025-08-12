// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { q } = await req.json().catch(() => ({ q: "" }));
    const term: string = (q || "").toString();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization') || '' },
      },
    });

    if (!term || term.trim().length < 2) {
      return new Response(JSON.stringify({
        processos: [], processos_count: 0,
        clients: [], clients_count: 0,
        profiles: [], profiles_count: 0,
        eventos: [], eventos_count: 0,
        contatos: [], contatos_count: 0,
        balancetes: [], balancetes_count: 0,
      }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const like = `%${term}%`;

    const [procData, procCount, cliData, cliCount, profData, profCount, evtData, evtCount, conData, conCount, balData, balCount] = await Promise.all([
      supabase.from('processos').select('id,titulo,status,prioridade,prazo', { count: 'exact' }).or(`titulo.ilike.${like}`) .limit(8),
      supabase.from('processos').select('*', { count: 'exact', head: true }).or(`titulo.ilike.${like}`),

      supabase.from('clients').select('id,nome_empresarial,nome_fantasia,cnpj', { count: 'exact' }).or(`nome_empresarial.ilike.${like},nome_fantasia.ilike.${like},cnpj.ilike.${like}`).limit(8),
      supabase.from('clients').select('*', { count: 'exact', head: true }).or(`nome_empresarial.ilike.${like},nome_fantasia.ilike.${like},cnpj.ilike.${like}`),

      supabase.from('profiles').select('id,nome,email,avatar_url', { count: 'exact' }).or(`nome.ilike.${like},email.ilike.${like}`).limit(8),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).or(`nome.ilike.${like},email.ilike.${like}`),

      supabase.from('events').select('id,titulo,setor,client_id', { count: 'exact' }).or(`titulo.ilike.${like},setor.ilike.${like}`).limit(8),
      supabase.from('events').select('*', { count: 'exact', head: true }).or(`titulo.ilike.${like},setor.ilike.${like}`),

      supabase.from('contacts').select('id,nome,email,telefone,client_id', { count: 'exact' }).or(`nome.ilike.${like},email.ilike.${like},telefone.ilike.${like}`).limit(8),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).or(`nome.ilike.${like},email.ilike.${like},telefone.ilike.${like}`),

      supabase.from('balancetes').select('id,empresa,periodo,mes,ano', { count: 'exact' }).or(`empresa.ilike.${like},periodo.ilike.${like}`).limit(8),
      supabase.from('balancetes').select('*', { count: 'exact', head: true }).or(`empresa.ilike.${like},periodo.ilike.${like}`),
    ]).then(async (res) => {
      // For head:true queries, supabase-js returns { data: null, count, error }
      return [
        res[0].data, res[1].count, res[2].data, res[3].count, res[4].data, res[5].count,
        res[6].data, res[7].count, res[8].data, res[9].count, res[10].data, res[11].count
      ] as any[];
    });

    const payload = {
      processos: procData || [], processos_count: procCount || (procData?.length || 0),
      clients: cliData || [], clients_count: cliCount || (cliData?.length || 0),
      profiles: profData || [], profiles_count: profCount || (profData?.length || 0),
      eventos: evtData || [], eventos_count: evtCount || (evtData?.length || 0),
      contatos: conData || [], contatos_count: conCount || (conData?.length || 0),
      balancetes: balData || [], balancetes_count: balCount || (balData?.length || 0),
    };

    return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (e) {
    console.error("search-global error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
