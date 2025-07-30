export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      balancetes: {
        Row: {
          ativo: number
          ativo_circulante: number
          ativo_circulante_credora: boolean | null
          ativo_credora: boolean | null
          ativo_nao_circulante: number
          ativo_nao_circulante_credora: boolean | null
          cnpj_empresa: string | null
          created_at: string
          id: string
          mes: string
          nome_empresa: string | null
          passivo: number
          passivo_circulante: number
          passivo_circulante_credora: boolean | null
          passivo_credora: boolean | null
          passivo_nao_circulante: number
          passivo_nao_circulante_credora: boolean | null
          updated_at: string
        }
        Insert: {
          ativo?: number
          ativo_circulante?: number
          ativo_circulante_credora?: boolean | null
          ativo_credora?: boolean | null
          ativo_nao_circulante?: number
          ativo_nao_circulante_credora?: boolean | null
          cnpj_empresa?: string | null
          created_at?: string
          id?: string
          mes: string
          nome_empresa?: string | null
          passivo?: number
          passivo_circulante?: number
          passivo_circulante_credora?: boolean | null
          passivo_credora?: boolean | null
          passivo_nao_circulante?: number
          passivo_nao_circulante_credora?: boolean | null
          updated_at?: string
        }
        Update: {
          ativo?: number
          ativo_circulante?: number
          ativo_circulante_credora?: boolean | null
          ativo_credora?: boolean | null
          ativo_nao_circulante?: number
          ativo_nao_circulante_credora?: boolean | null
          cnpj_empresa?: string | null
          created_at?: string
          id?: string
          mes?: string
          nome_empresa?: string | null
          passivo?: number
          passivo_circulante?: number
          passivo_circulante_credora?: boolean | null
          passivo_credora?: boolean | null
          passivo_nao_circulante?: number
          passivo_nao_circulante_credora?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      balancetes_importados: {
        Row: {
          cliente_id: string | null
          cnpj_empresa: string | null
          created_at: string
          dados_completos: Json
          id: string
          mes: string
          nome_arquivo: string
          nome_empresa: string
          parametrizado: boolean
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          cnpj_empresa?: string | null
          created_at?: string
          dados_completos: Json
          id?: string
          mes: string
          nome_arquivo: string
          nome_empresa: string
          parametrizado?: boolean
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          cnpj_empresa?: string | null
          created_at?: string
          dados_completos?: Json
          id?: string
          mes?: string
          nome_arquivo?: string
          nome_empresa?: string
          parametrizado?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "balancetes_importados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          bairro: string
          cep: string
          cliente_desde: string
          cnpj: string
          complemento: string | null
          created_at: string
          fim_contrato: string | null
          id: string
          logradouro: string
          municipio: string
          nome_empresarial: string
          nome_fantasia: string | null
          numero: string
          ramo_atividade: string
          uf: string
          updated_at: string
        }
        Insert: {
          bairro: string
          cep: string
          cliente_desde: string
          cnpj: string
          complemento?: string | null
          created_at?: string
          fim_contrato?: string | null
          id?: string
          logradouro: string
          municipio: string
          nome_empresarial: string
          nome_fantasia?: string | null
          numero: string
          ramo_atividade: string
          uf: string
          updated_at?: string
        }
        Update: {
          bairro?: string
          cep?: string
          cliente_desde?: string
          cnpj?: string
          complemento?: string | null
          created_at?: string
          fim_contrato?: string | null
          id?: string
          logradouro?: string
          municipio?: string
          nome_empresarial?: string
          nome_fantasia?: string | null
          numero?: string
          ramo_atividade?: string
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      colaborador_invites: {
        Row: {
          accepted_at: string | null
          colaborador_id: string
          created_at: string
          expires_at: string
          id: string
          invite_token: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          colaborador_id: string
          created_at?: string
          expires_at: string
          id?: string
          invite_token: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          colaborador_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invite_token?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_invites_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nome: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          nome: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          cnpj: string
          created_at: string
          endereco: string
          id: string
          instagram: string | null
          logo_url: string | null
          nome: string
          telefone: string
          updated_at: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          endereco: string
          id?: string
          instagram?: string | null
          logo_url?: string | null
          nome: string
          telefone: string
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          endereco?: string
          id?: string
          instagram?: string | null
          logo_url?: string | null
          nome?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: []
      }
      contatos: {
        Row: {
          cliente_id: string
          created_at: string
          email: string
          id: string
          nome: string
          telefone: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          email: string
          id?: string
          nome: string
          telefone: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          email?: string
          id?: string
          nome?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: []
      }
      eventos: {
        Row: {
          cliente_id: string
          created_at: string
          data_evento: string
          descricao: string
          id: string
          setor: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_evento: string
          descricao: string
          id?: string
          setor: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_evento?: string
          descricao?: string
          id?: string
          setor?: string
          updated_at?: string
        }
        Relationships: []
      }
      parametrizacoes: {
        Row: {
          cnpj_empresa: string
          codigo_plano_padrao: string
          conta_original: string
          created_at: string
          id: string
          multiplas_contas: boolean | null
          updated_at: string
        }
        Insert: {
          cnpj_empresa: string
          codigo_plano_padrao: string
          conta_original: string
          created_at?: string
          id?: string
          multiplas_contas?: boolean | null
          updated_at?: string
        }
        Update: {
          cnpj_empresa?: string
          codigo_plano_padrao?: string
          conta_original?: string
          created_at?: string
          id?: string
          multiplas_contas?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parametrizacoes_codigo_plano_padrao_fkey"
            columns: ["codigo_plano_padrao"]
            isOneToOne: false
            referencedRelation: "plano_contas_padrao"
            referencedColumns: ["codigo"]
          },
        ]
      }
      parametrizacoes_contas: {
        Row: {
          cnpj_empresa: string
          codigo_plano_padrao: string
          conta_original: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          cnpj_empresa: string
          codigo_plano_padrao: string
          conta_original: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          cnpj_empresa?: string
          codigo_plano_padrao?: string
          conta_original?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parametrizacoes_contas_codigo_plano_padrao_fkey"
            columns: ["codigo_plano_padrao"]
            isOneToOne: false
            referencedRelation: "plano_contas_padrao"
            referencedColumns: ["codigo"]
          },
        ]
      }
      plano_contas_padrao: {
        Row: {
          ativo: boolean
          categoria: string
          codigo: string
          created_at: string
          id: string
          nivel: number
          nome: string
          pai_id: string | null
          subcategoria: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          codigo: string
          created_at?: string
          id?: string
          nivel?: number
          nome: string
          pai_id?: string | null
          subcategoria?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          codigo?: string
          created_at?: string
          id?: string
          nivel?: number
          nome?: string
          pai_id?: string | null
          subcategoria?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_contas_padrao_pai_id_fkey"
            columns: ["pai_id"]
            isOneToOne: false
            referencedRelation: "plano_contas_padrao"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          colaborador_id: string | null
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string
          id: string
          updated_at?: string
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      tributacoes: {
        Row: {
          ativo: boolean
          cliente_id: string
          created_at: string
          data_inicio: string
          id: string
          regime_tributario: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          created_at?: string
          data_inicio: string
          id?: string
          regime_tributario: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          created_at?: string
          data_inicio?: string
          id?: string
          regime_tributario?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tributacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
