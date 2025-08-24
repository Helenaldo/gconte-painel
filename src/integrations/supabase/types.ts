export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      access_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          jti: string
          last_used_at: string | null
          nome: string
          revoked_at: string | null
          revoked_by: string | null
          role: string
          scopes: string[]
          status: string
          tenant: string
          token_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          jti: string
          last_used_at?: string | null
          nome: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          scopes?: string[]
          status?: string
          tenant: string
          token_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          jti?: string
          last_used_at?: string | null
          nome?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          scopes?: string[]
          status?: string
          tenant?: string
          token_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      anexos: {
        Row: {
          created_at: string
          id: string
          mime: string
          movimento_id: string
          nome_arquivo: string
          tamanho: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime: string
          movimento_id: string
          nome_arquivo: string
          tamanho: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          mime?: string
          movimento_id?: string
          nome_arquivo?: string
          tamanho?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "anexos_movimento_id_fkey"
            columns: ["movimento_id"]
            isOneToOne: false
            referencedRelation: "movimentos"
            referencedColumns: ["id"]
          },
        ]
      }
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
      certificados_auditoria: {
        Row: {
          acao: string
          certificado_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          acao: string
          certificado_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          acao?: string
          certificado_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      certificados_digitais: {
        Row: {
          client_id: string
          cnpj_certificado: string
          created_at: string
          data_inicio: string
          data_vencimento: string
          emissor: string
          id: string
          mime_type: string
          nome_arquivo: string
          numero_serie: string
          senha_criptografada: string
          tamanho: number
          updated_at: string
          url: string
        }
        Insert: {
          client_id: string
          cnpj_certificado: string
          created_at?: string
          data_inicio: string
          data_vencimento: string
          emissor: string
          id?: string
          mime_type?: string
          nome_arquivo: string
          numero_serie: string
          senha_criptografada: string
          tamanho: number
          updated_at?: string
          url: string
        }
        Update: {
          client_id?: string
          cnpj_certificado?: string
          created_at?: string
          data_inicio?: string
          data_vencimento?: string
          emissor?: string
          id?: string
          mime_type?: string
          nome_arquivo?: string
          numero_serie?: string
          senha_criptografada?: string
          tamanho?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificados_digitais_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_certificados_digitais_client_id"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
          saldo_anterior: number
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
          saldo_anterior?: number
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
          saldo_anterior?: number
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
      movimentos: {
        Row: {
          anexos: Json
          created_at: string
          data_mov: string
          descricao: string | null
          id: string
          prazo_mov: string | null
          processo_id: string
          responsavel_id: string
          status_mov: Database["public"]["Enums"]["status_mov"]
          tipo: Database["public"]["Enums"]["movimento_tipo"]
          updated_at: string
        }
        Insert: {
          anexos?: Json
          created_at?: string
          data_mov?: string
          descricao?: string | null
          id?: string
          prazo_mov?: string | null
          processo_id: string
          responsavel_id: string
          status_mov?: Database["public"]["Enums"]["status_mov"]
          tipo: Database["public"]["Enums"]["movimento_tipo"]
          updated_at?: string
        }
        Update: {
          anexos?: Json
          created_at?: string
          data_mov?: string
          descricao?: string | null
          id?: string
          prazo_mov?: string | null
          processo_id?: string
          responsavel_id?: string
          status_mov?: Database["public"]["Enums"]["status_mov"]
          tipo?: Database["public"]["Enums"]["movimento_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      obligations_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          document_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          document_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          document_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      obligations_documents: {
        Row: {
          checksum: string | null
          created_at: string
          description: string | null
          file_name: string
          file_size: number
          file_url: string
          id: string
          idempotency_key: string | null
          mime_type: string
          title: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          description?: string | null
          file_name: string
          file_size: number
          file_url: string
          id?: string
          idempotency_key?: string | null
          mime_type?: string
          title: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number
          file_url?: string
          id?: string
          idempotency_key?: string | null
          mime_type?: string
          title?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
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
      orgao_documentos_modelo: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          nome_arquivo: string
          orgao_id: string
          tamanho: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          nome_arquivo: string
          orgao_id: string
          tamanho: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          nome_arquivo?: string
          orgao_id?: string
          tamanho?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "orgao_documentos_modelo_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgaos_instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      orgaos_instituicoes: {
        Row: {
          created_at: string
          email: string | null
          id: string
          link_dinamico: string | null
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          link_dinamico?: string | null
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          link_dinamico?: string | null
          nome?: string
          telefone?: string | null
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
      parametrizacoes_valores: {
        Row: {
          competencia: string
          created_at: string
          empresa_id: string
          id: string
          plano_padrao_conta_id: string
          saldo_anterior: number
          saldo_atual: number
          updated_at: string
        }
        Insert: {
          competencia: string
          created_at?: string
          empresa_id: string
          id?: string
          plano_padrao_conta_id: string
          saldo_anterior?: number
          saldo_atual?: number
          updated_at?: string
        }
        Update: {
          competencia?: string
          created_at?: string
          empresa_id?: string
          id?: string
          plano_padrao_conta_id?: string
          saldo_anterior?: number
          saldo_atual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parametrizacoes_valores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parametrizacoes_valores_plano_padrao_conta_id_fkey"
            columns: ["plano_padrao_conta_id"]
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
      process_checklist_items: {
        Row: {
          created_at: string
          done: boolean
          id: string
          position: number
          process_id: string
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          process_id: string
          text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          process_id?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_checklist_items_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      process_types: {
        Row: {
          checklist_model: string[]
          created_at: string
          id: string
          nome: string
          prazo_default: number
          prefixo: string | null
          setor_default: string
          updated_at: string
        }
        Insert: {
          checklist_model?: string[]
          created_at?: string
          id?: string
          nome: string
          prazo_default?: number
          prefixo?: string | null
          setor_default: string
          updated_at?: string
        }
        Update: {
          checklist_model?: string[]
          created_at?: string
          id?: string
          nome?: string
          prazo_default?: number
          prefixo?: string | null
          setor_default?: string
          updated_at?: string
        }
        Relationships: []
      }
      processos: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_abertura: string
          data_conclusao: string | null
          descricao: string | null
          etiquetas: string[]
          id: string
          orgao_id: string | null
          origem: string | null
          prazo: string | null
          prioridade: Database["public"]["Enums"]["process_prioridade"]
          processo_numero: string | null
          responsavel_id: string
          setor: Database["public"]["Enums"]["process_setor"]
          status: Database["public"]["Enums"]["process_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_abertura?: string
          data_conclusao?: string | null
          descricao?: string | null
          etiquetas?: string[]
          id?: string
          orgao_id?: string | null
          origem?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["process_prioridade"]
          processo_numero?: string | null
          responsavel_id: string
          setor: Database["public"]["Enums"]["process_setor"]
          status?: Database["public"]["Enums"]["process_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_abertura?: string
          data_conclusao?: string | null
          descricao?: string | null
          etiquetas?: string[]
          id?: string
          orgao_id?: string | null
          origem?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["process_prioridade"]
          processo_numero?: string | null
          responsavel_id?: string
          setor?: Database["public"]["Enums"]["process_setor"]
          status?: Database["public"]["Enums"]["process_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgaos_instituicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      token_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          endpoint: string | null
          id: string
          ip_address: string | null
          token_jti: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          endpoint?: string | null
          id?: string
          ip_address?: string | null
          token_jti: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          endpoint?: string | null
          id?: string
          ip_address?: string | null
          token_jti?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
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
      movimento_tipo:
        | "anotacao"
        | "protocolo"
        | "solicitacao"
        | "retorno_orgao"
        | "exigencia"
        | "envio_cliente"
        | "upload"
      process_prioridade: "baixa" | "media" | "alta" | "critica"
      process_setor:
        | "contabil"
        | "fiscal"
        | "pessoal"
        | "societario"
        | "financeiro"
        | "outro"
      process_status:
        | "aberto"
        | "em_andamento"
        | "aguardando_terceiros"
        | "em_revisao"
        | "concluido"
        | "cancelado"
      status_mov: "pendente" | "feito" | "cancelado"
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
      movimento_tipo: [
        "anotacao",
        "protocolo",
        "solicitacao",
        "retorno_orgao",
        "exigencia",
        "envio_cliente",
        "upload",
      ],
      process_prioridade: ["baixa", "media", "alta", "critica"],
      process_setor: [
        "contabil",
        "fiscal",
        "pessoal",
        "societario",
        "financeiro",
        "outro",
      ],
      process_status: [
        "aberto",
        "em_andamento",
        "aguardando_terceiros",
        "em_revisao",
        "concluido",
        "cancelado",
      ],
      status_mov: ["pendente", "feito", "cancelado"],
    },
  },
} as const
