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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      addresses: {
        Row: {
          apartment: string | null
          city: string
          created_at: string
          createdAt: string
          id: string
          label: string
          notes: string | null
          number: string
          postal_code: string | null
          postalCode: string
          province: string
          street: string
          updated_at: string
          updatedAt: string
          user_id: string | null
          userId: string
        }
        Insert: {
          apartment?: string | null
          city: string
          created_at?: string
          createdAt?: string
          id?: string
          label?: string
          notes?: string | null
          number: string
          postal_code?: string | null
          postalCode: string
          province: string
          street: string
          updated_at?: string
          updatedAt: string
          user_id?: string | null
          userId: string
        }
        Update: {
          apartment?: string | null
          city?: string
          created_at?: string
          createdAt?: string
          id?: string
          label?: string
          notes?: string | null
          number?: string
          postal_code?: string | null
          postalCode?: string
          province?: string
          street?: string
          updated_at?: string
          updatedAt?: string
          user_id?: string | null
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          admin_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          ip: string | null
          message: string | null
          metadata: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          admin_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip?: string | null
          message?: string | null
          metadata?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          admin_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip?: string | null
          message?: string | null
          metadata?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_feedback: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          knowledge_slug: string | null
          rating: string
          trace_id: string
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          knowledge_slug?: string | null
          rating: string
          trace_id: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          knowledge_slug?: string | null
          rating?: string
          trace_id?: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_knowledge: {
        Row: {
          actions: Json
          active: boolean
          alternate_answer: string | null
          answer: string
          created_at: string
          created_by: string | null
          id: string
          intent: string
          keywords: string[]
          phrases: string[]
          published_at: string | null
          slug: string
          source_href: string
          source_label: string
          title: string
          topic: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          actions?: Json
          active?: boolean
          alternate_answer?: string | null
          answer: string
          created_at?: string
          created_by?: string | null
          id?: string
          intent?: string
          keywords?: string[]
          phrases?: string[]
          published_at?: string | null
          slug: string
          source_href: string
          source_label: string
          title: string
          topic: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          actions?: Json
          active?: boolean
          alternate_answer?: string | null
          answer?: string
          created_at?: string
          created_by?: string | null
          id?: string
          intent?: string
          keywords?: string[]
          phrases?: string[]
          published_at?: string | null
          slug?: string
          source_href?: string
          source_label?: string
          title?: string
          topic?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      assistant_knowledge_versions: {
        Row: {
          changed_by: string | null
          created_at: string
          id: number
          knowledge_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: number
          knowledge_id: string
          snapshot: Json
          version: number
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: number
          knowledge_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assistant_knowledge_versions_knowledge_id_fkey"
            columns: ["knowledge_id"]
            isOneToOne: false
            referencedRelation: "assistant_knowledge"
            referencedColumns: ["id"]
          },
        ]
      }
      AuditLog: {
        Row: {
          action: string
          actorEmail: string | null
          actorId: string | null
          actorRole: string | null
          createdAt: string
          entity: string
          entityId: string | null
          id: string
          ip: string | null
          message: string
          metadata: Json | null
          userAgent: string | null
        }
        Insert: {
          action: string
          actorEmail?: string | null
          actorId?: string | null
          actorRole?: string | null
          createdAt?: string
          entity: string
          entityId?: string | null
          id: string
          ip?: string | null
          message: string
          metadata?: Json | null
          userAgent?: string | null
        }
        Update: {
          action?: string
          actorEmail?: string | null
          actorId?: string | null
          actorRole?: string | null
          createdAt?: string
          entity?: string
          entityId?: string | null
          id?: string
          ip?: string | null
          message?: string
          metadata?: Json | null
          userAgent?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          assigned_admin_id: string | null
          channel: string
          created_at: string
          id: string
          status: string
          subject: string | null
          updated_at: string
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          assigned_admin_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          assigned_admin_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          sender_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          sender_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      consumer_refund_requests: {
        Row: {
          created_at: string
          details: string
          email: string
          full_name: string
          id: string
          idempotency_key: string | null
          metadata: Json
          order_id: string | null
          order_number: string | null
          phone: string
          preferred_contact: string
          reason: string
          request_number: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details: string
          email: string
          full_name: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          order_id?: string | null
          order_number?: string | null
          phone: string
          preferred_contact?: string
          reason: string
          request_number: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string
          email?: string
          full_name?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          order_id?: string | null
          order_number?: string | null
          phone?: string
          preferred_contact?: string
          reason?: string
          request_number?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumer_refund_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumer_refund_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumer_refund_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_movements: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          description: string
          id: string
          metadata: Json
          occurred_at: string
          source: string
          status: string
          type: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          metadata?: Json
          occurred_at?: string
          source?: string
          status?: string
          type: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          source?: string
          status?: string
          type?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_movements_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_id: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json | null
          order_id: string | null
          product_id: string
          quantity: number
          reason: string | null
          stock_after: number | null
          stock_before: number | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          stock_after?: number | null
          stock_before?: number | null
          type: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          stock_after?: number | null
          stock_before?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      Notification: {
        Row: {
          createdAt: string
          id: string
          linkTo: string | null
          message: string
          orderId: string | null
          read: boolean
          title: string
          type: string
          updatedAt: string
          userId: string | null
        }
        Insert: {
          createdAt?: string
          id: string
          linkTo?: string | null
          message: string
          orderId?: string | null
          read?: boolean
          title: string
          type: string
          updatedAt: string
          userId?: string | null
        }
        Update: {
          createdAt?: string
          id?: string
          linkTo?: string | null
          message?: string
          orderId?: string | null
          read?: boolean
          title?: string
          type?: string
          updatedAt?: string
          userId?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link_to: string | null
          message: string
          read: boolean
          read_at: string | null
          target_role: string | null
          title: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          link_to?: string | null
          message: string
          read?: boolean
          read_at?: string | null
          target_role?: string | null
          title: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          link_to?: string | null
          message?: string
          read?: boolean
          read_at?: string | null
          target_role?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
          order_id: string
          product_id: string | null
          quantity: number
          sku: string | null
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          order_id: string
          product_id?: string | null
          quantity: number
          sku?: string | null
          subtotal?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_snapshot: Json | null
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id: string
          notes: string | null
          paid_at: string | null
          shipping_cost: number
          shipping_method: string
          status: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address_snapshot?: Json | null
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          shipping_cost?: number
          shipping_method?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address_snapshot?: Json | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          shipping_cost?: number
          shipping_method?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string | null
          id: string
          order_id: string | null
          processed_at: string | null
          provider: string
          provider_event_id: string | null
          provider_payment_id: string | null
          raw: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          order_id?: string | null
          processed_at?: string | null
          provider?: string
          provider_event_id?: string | null
          provider_payment_id?: string | null
          raw?: Json | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          order_id?: string | null
          processed_at?: string | null
          provider?: string
          provider_event_id?: string | null
          provider_payment_id?: string | null
          raw?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          order_id: string
          provider: string
          provider_payment_id: string | null
          provider_preference_id: string | null
          provider_session_id: string | null
          raw: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_id: string
          provider?: string
          provider_payment_id?: string | null
          provider_preference_id?: string | null
          provider_session_id?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          provider?: string
          provider_payment_id?: string | null
          provider_preference_id?: string | null
          provider_session_id?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_events: {
        Row: {
          createdAt: string
          id: string
          metadata: Json | null
          productId: string
          sessionId: string | null
          type: string
          userId: string | null
        }
        Insert: {
          createdAt?: string
          id: string
          metadata?: Json | null
          productId: string
          sessionId?: string | null
          type: string
          userId?: string | null
        }
        Update: {
          createdAt?: string
          id?: string
          metadata?: Json | null
          productId?: string
          sessionId?: string | null
          type?: string
          userId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_events_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_views: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          brand: string | null
          category_id: string | null
          compare_price: number | null
          created_at: string
          description: string | null
          featured: boolean
          gallery: Json
          id: string
          image_url: string | null
          name: string
          on_sale: boolean
          price: number
          sku: string
          slug: string
          specifications: Json
          stock: number
          stock_minimum: number
          subcategory: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category_id?: string | null
          compare_price?: number | null
          created_at?: string
          description?: string | null
          featured?: boolean
          gallery?: Json
          id?: string
          image_url?: string | null
          name: string
          on_sale?: boolean
          price?: number
          sku: string
          slug: string
          specifications?: Json
          stock?: number
          stock_minimum?: number
          subcategory?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          category_id?: string | null
          compare_price?: number | null
          created_at?: string
          description?: string | null
          featured?: boolean
          gallery?: Json
          id?: string
          image_url?: string | null
          name?: string
          on_sale?: boolean
          price?: number
          sku?: string
          slug?: string
          specifications?: Json
          stock?: number
          stock_minimum?: number
          subcategory?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_login_at: string | null
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          last_login_at?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_ticket_items: {
        Row: {
          created_at: string
          id: string
          name: string
          product_id: string | null
          quantity: number
          sku: string | null
          stock_after: number | null
          stock_before: number | null
          subtotal: number
          ticket_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          product_id?: string | null
          quantity: number
          sku?: string | null
          stock_after?: number | null
          stock_before?: number | null
          subtotal?: number
          ticket_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          stock_after?: number | null
          stock_before?: number | null
          subtotal?: number
          ticket_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_ticket_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_ticket_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "purchase_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_tickets: {
        Row: {
          address_snapshot: Json | null
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          discount: number
          id: string
          issued_at: string
          notes: string | null
          number: string
          order_id: string
          payment_id: string | null
          payment_provider: string | null
          shipping_cost: number
          shipping_method: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          address_snapshot?: Json | null
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          discount?: number
          id?: string
          issued_at?: string
          notes?: string | null
          number: string
          order_id: string
          payment_id?: string | null
          payment_provider?: string | null
          shipping_cost?: number
          shipping_method?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          address_snapshot?: Json | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          discount?: number
          id?: string
          issued_at?: string
          notes?: string | null
          number?: string
          order_id?: string
          payment_id?: string | null
          payment_provider?: string | null
          shipping_cost?: number
          shipping_method?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          approved: boolean
          comment: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approved?: boolean
          comment?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approved?: boolean
          comment?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      search_events: {
        Row: {
          created_at: string
          id: string
          query: string
          results_count: number
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          results_count?: number
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          results_count?: number
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          background_color: string
          card_color: string
          created_at: string
          email: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          metadata: Json
          primary_color: string
          store_name: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          background_color?: string
          card_color?: string
          created_at?: string
          email?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          metadata?: Json
          primary_color?: string
          store_name?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          background_color?: string
          card_color?: string
          created_at?: string
          email?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          metadata?: Json
          primary_color?: string
          store_name?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          assistantHistory: boolean
          createdAt: string
          id: string
          marketingEmails: boolean
          orderUpdates: boolean
          preferredShipping:
            | Database["public"]["Enums"]["ShippingMethod"]
            | null
          theme: string
          updatedAt: string
          userId: string
        }
        Insert: {
          assistantHistory?: boolean
          createdAt?: string
          id: string
          marketingEmails?: boolean
          orderUpdates?: boolean
          preferredShipping?:
            | Database["public"]["Enums"]["ShippingMethod"]
            | null
          theme?: string
          updatedAt: string
          userId: string
        }
        Update: {
          assistantHistory?: boolean
          createdAt?: string
          id?: string
          marketingEmails?: boolean
          orderUpdates?: boolean
          preferredShipping?:
            | Database["public"]["Enums"]["ShippingMethod"]
            | null
          theme?: string
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          authProvider: Database["public"]["Enums"]["AuthProvider"]
          avatarUrl: string | null
          createdAt: string
          email: string
          id: string
          lastLoginAt: string | null
          name: string
          password: string | null
          phone: string | null
          refreshToken: string | null
          role: Database["public"]["Enums"]["Role"]
          supabaseId: string | null
          updatedAt: string
        }
        Insert: {
          authProvider?: Database["public"]["Enums"]["AuthProvider"]
          avatarUrl?: string | null
          createdAt?: string
          email: string
          id: string
          lastLoginAt?: string | null
          name: string
          password?: string | null
          phone?: string | null
          refreshToken?: string | null
          role?: Database["public"]["Enums"]["Role"]
          supabaseId?: string | null
          updatedAt: string
        }
        Update: {
          authProvider?: Database["public"]["Enums"]["AuthProvider"]
          avatarUrl?: string | null
          createdAt?: string
          email?: string
          id?: string
          lastLoginAt?: string | null
          name?: string
          password?: string | null
          phone?: string | null
          refreshToken?: string | null
          role?: Database["public"]["Enums"]["Role"]
          supabaseId?: string | null
          updatedAt?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      checkout_integrity_status: { Args: never; Returns: Json }
      create_checkout_order: {
        Args: {
          p_address_snapshot: Json
          p_customer_email: string
          p_customer_name: string
          p_customer_phone: string
          p_idempotency_key: string
          p_items: Json
          p_notes: string
          p_order_status: string
          p_payment_provider: string
          p_payment_raw: Json
          p_shipping_cost: number
          p_shipping_method: string
          p_subtotal: number
          p_total: number
          p_user_id: string
        }
        Returns: Json
      }
      finalize_paid_order: {
        Args: {
          p_order_id: string
          p_provider_payment_id?: string
          p_raw?: Json
        }
        Returns: Json
      }
      finalize_refunded_order: {
        Args: {
          p_actor_email: string
          p_actor_id: string
          p_payment_id: string
          p_provider_refund_id: string
          p_raw: Json
          p_reason: string
        }
        Returns: Json
      }
      generate_ticket_number: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      request_is_service_role: { Args: never; Returns: boolean }
    }
    Enums: {
      AuthProvider: "LOCAL" | "GOOGLE"
      ChatChannel: "AI" | "SUPPORT"
      ChatRole: "USER" | "ASSISTANT" | "ADMIN" | "SYSTEM"
      ChatStatus: "OPEN" | "WAITING_ADMIN" | "RESOLVED" | "CLOSED"
      InventoryMovementType: "SALE" | "RETURN" | "ADJUSTMENT"
      OrderStatus:
        | "PENDING"
        | "PAID"
        | "PREPARING"
        | "SHIPPED"
        | "DELIVERED"
        | "CANCELLED"
        | "PENDING_PAYMENT"
        | "CONFIRMED"
        | "READY_FOR_PICKUP"
        | "OUT_FOR_DELIVERY"
        | "COMPLETED"
      PaymentStatus: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED"
      Role: "USER" | "ADMIN" | "OPERATOR"
      ShippingMethod: "PICKUP" | "DELIVERY"
      TicketStatus: "ISSUED" | "PRINTED" | "CANCELLED"
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
      AuthProvider: ["LOCAL", "GOOGLE"],
      ChatChannel: ["AI", "SUPPORT"],
      ChatRole: ["USER", "ASSISTANT", "ADMIN", "SYSTEM"],
      ChatStatus: ["OPEN", "WAITING_ADMIN", "RESOLVED", "CLOSED"],
      InventoryMovementType: ["SALE", "RETURN", "ADJUSTMENT"],
      OrderStatus: [
        "PENDING",
        "PAID",
        "PREPARING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "PENDING_PAYMENT",
        "CONFIRMED",
        "READY_FOR_PICKUP",
        "OUT_FOR_DELIVERY",
        "COMPLETED",
      ],
      PaymentStatus: ["PENDING", "PAID", "FAILED", "EXPIRED", "REFUNDED"],
      Role: ["USER", "ADMIN", "OPERATOR"],
      ShippingMethod: ["PICKUP", "DELIVERY"],
      TicketStatus: ["ISSUED", "PRINTED", "CANCELLED"],
    },
  },
} as const
