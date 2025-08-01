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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      balancetes: {
        Row: {
          ano: number
          arquivo_nome: string
          cnpj: string
          contas_parametrizadas: number | null
          created_at: string | null
          empresa: string
          id: string
          mes: number
          periodo: string
          status: string
          total_contas: number | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          arquivo_nome: string
          cnpj: string
          contas_parametrizadas?: number | null
          created_at?: string | null
          empresa: string
          id?: string
          mes: number
          periodo: string
          status?: string
          total_contas?: number | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          arquivo_nome?: string
          cnpj?: string
          contas_parametrizadas?: number | null
          created_at?: string | null
          empresa?: string
          id?: string
          mes?: number
          periodo?: string
          status?: string
          total_contas?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          bairro: string | null
          cep: string | null
          cliente_desde: string
          cnpj: string
          complemento: string | null
          created_at: string
          fim_contrato: string | null
          id: string
          logradouro: string | null
          municipio: string | null
          nome_empresarial: string
          nome_fantasia: string | null
          numero: string | null
          ramo_atividade: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cliente_desde?: string
          cnpj: string
          complemento?: string | null
          created_at?: string
          fim_contrato?: string | null
          id?: string
          logradouro?: string | null
          municipio?: string | null
          nome_empresarial: string
          nome_fantasia?: string | null
          numero?: string | null
          ramo_atividade: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cliente_desde?: string
          cnpj?: string
          complemento?: string | null
          created_at?: string
          fim_contrato?: string | null
          id?: string
          logradouro?: string | null
          municipio?: string | null
          nome_empresarial?: string
          nome_fantasia?: string | null
          numero?: string | null
          ramo_atividade?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string
          id: string
          nome: string
          telefone: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email: string
          id?: string
          nome: string
          telefone: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string
          id?: string
          nome?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_balancete: {
        Row: {
          balancete_id: string
          codigo: string
          created_at: string | null
          id: string
          natureza: string
          nome: string
          saldo_atual: number
          updated_at: string | null
        }
        Insert: {
          balancete_id: string
          codigo: string
          created_at?: string | null
          id?: string
          natureza: string
          nome: string
          saldo_atual: number
          updated_at?: string | null
        }
        Update: {
          balancete_id?: string
          codigo?: string
          created_at?: string | null
          id?: string
          natureza?: string
          nome?: string
          saldo_atual?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_balancete_balancete_id_fkey"
            columns: ["balancete_id"]
            isOneToOne: false
            referencedRelation: "balancetes"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          client_id: string
          created_at: string
          data: string
          descricao: string | null
          id: string
          setor: string
          titulo: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
          setor: string
          titulo: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          setor?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          nome: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          nome: string
          role?: Database["public"]["Enums"]["app_role"]
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          nome?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      office: {
        Row: {
          bairro: string | null
          cep: string | null
          cnpj: string
          complemento: string | null
          created_at: string
          email: string | null
          id: string
          instagram: string | null
          logomarca_url: string | null
          logradouro: string | null
          municipio: string | null
          nome: string
          numero: string | null
          telefone: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cnpj: string
          complemento?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          logomarca_url?: string | null
          logradouro?: string | null
          municipio?: string | null
          nome: string
          numero?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cnpj?: string
          complemento?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          logomarca_url?: string | null
          logradouro?: string | null
          municipio?: string | null
          nome?: string
          numero?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      parametrizacoes: {
        Row: {
          conta_balancete_codigo: string
          conta_balancete_nome: string
          created_at: string
          empresa_cnpj: string
          id: string
          plano_conta_id: string
          updated_at: string
        }
        Insert: {
          conta_balancete_codigo: string
          conta_balancete_nome: string
          created_at?: string
          empresa_cnpj: string
          id?: string
          plano_conta_id: string
          updated_at?: string
        }
        Update: {
          conta_balancete_codigo?: string
          conta_balancete_nome?: string
          created_at?: string
          empresa_cnpj?: string
          id?: string
          plano_conta_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parametrizacoes_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_contas: {
        Row: {
          codigo: string
          created_at: string
          grupo: string
          id: string
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          grupo: string
          id?: string
          nome: string
          tipo: string
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          grupo?: string
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nome: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          nome: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      taxation: {
        Row: {
          client_id: string
          created_at: string
          data: string
          descricao: string | null
          id: string
          status: string
          tipo: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
          status?: string
          tipo: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "taxation_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fetch_cnpj_data: {
        Args: { cnpj_param: string }
        Returns: Json
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      make_user_admin: {
        Args: { user_email: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "operador" | "administrador"
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
    Enums: {
      app_role: ["operador", "administrador"],
    },
  },
} as const
