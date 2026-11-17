import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ipysgklvszagvobuvyml.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_0PBi1iaqcwiU6r-ZnENHgA_abCyJXEg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)