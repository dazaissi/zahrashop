import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const REQUIRED_TABLES = [
  'customers',
  'products',
  'invoices',
  'invoice_items',
  'invoice_payments',
  'stock_movements',
  'expenses'
]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '')

  const { data: userData, error: authError } = await supabase.auth.getUser(
    token
  )
  if (authError || !userData.user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (String(profile?.role || '').toLowerCase() !== 'owner') {
    return json({ error: 'Hanya Owner yang dapat melakukan restore.' }, 403)
  }

  let body: {
    payload?: Record<string, unknown>
    mode?: 'merge' | 'replace'
    dryRun?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body tidak valid.' }, 400)
  }

  const { payload, mode = 'merge', dryRun = false } = body

  if (!payload || typeof payload !== 'object') {
    return json({ error: 'Payload backup kosong atau tidak valid.' }, 400)
  }

  const meta = (payload as Record<string, unknown>).meta as
    | Record<string, unknown>
    | undefined

  if (meta?.app !== 'Zahra Shop') {
    return json(
      { error: 'File backup bukan dari Zahra Shop yang valid.' },
      400
    )
  }

  const preview: Record<string, number> = {}
  for (const t of REQUIRED_TABLES) {
    const arr = (payload as Record<string, unknown>)[t]
    if (!Array.isArray(arr)) {
      return json(
        { error: `Tabel "${t}" tidak ditemukan atau bukan array.` },
        400
      )
    }
    preview[t] = arr.length
  }

  const profiles = (payload as Record<string, unknown>).profiles
  preview.profiles = Array.isArray(profiles) ? profiles.length : 0

  if (dryRun) {
    return json({ preview, mode })
  }

  const { data: result, error } = await supabase.rpc(
    'restore_backup_data',
    {
      p_payload: payload,
      p_user_id: userData.user.id,
      p_mode: mode
    }
  )

  if (error) {
    await supabase.from('backup_logs').insert({
      filename: `restore_failed_${new Date().toISOString()}.json`,
      status: 'failed',
      triggered_by: 'manual',
      created_by: userData.user.id,
      error_message: error.message
    })
    return json({ error: error.message }, 500)
  }

  await supabase.from('backup_logs').insert({
    filename: `restore_${new Date().toISOString()}.json`,
    status: 'restored',
    triggered_by: 'manual',
    created_by: userData.user.id,
    metadata: result
  })

  return json({ success: true, result })
})