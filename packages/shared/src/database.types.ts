
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "account_settings": {
                  Row: {
                    "allow_messages_from": string,"contacts_discoverable": boolean,"created_at": string,"default_status_audience": string,"locale": string,"notify_live": boolean,"notify_messages": boolean,"notify_offers": boolean,"notify_push": boolean,"notify_social": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_messages_from"?: string,"contacts_discoverable"?: boolean,"created_at"?: string,"default_status_audience"?: string,"locale"?: string,"notify_live"?: boolean,"notify_messages"?: boolean,"notify_offers"?: boolean,"notify_push"?: boolean,"notify_social"?: boolean,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "allow_messages_from"?: string,"contacts_discoverable"?: boolean,"created_at"?: string,"default_status_audience"?: string,"locale"?: string,"notify_live"?: boolean,"notify_messages"?: boolean,"notify_offers"?: boolean,"notify_push"?: boolean,"notify_social"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_settings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"agreements": {
                  Row: {
                    "amount_xof": number,"buyer_completed_at": string | null,"buyer_id": string,"cash_payer": string | null,"close_reason": string | null,"closed_by": string | null,"conversation_id": string,"created_at": string,"id": string,"kind": string,"offer_id": string,"offered_product_id": string | null,"product_id": string | null,"seller_completed_at": string | null,"seller_id": string,"status": string,"terms": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_xof": number,"buyer_completed_at"?: string | null,"buyer_id": string,"cash_payer"?: string | null,"close_reason"?: string | null,"closed_by"?: string | null,"conversation_id": string,"created_at"?: string,"id"?: string,"kind": string,"offer_id": string,"offered_product_id"?: string | null,"product_id"?: string | null,"seller_completed_at"?: string | null,"seller_id": string,"status"?: string,"terms": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "amount_xof"?: number,"buyer_completed_at"?: string | null,"buyer_id"?: string,"cash_payer"?: string | null,"close_reason"?: string | null,"closed_by"?: string | null,"conversation_id"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"offer_id"?: string,"offered_product_id"?: string | null,"product_id"?: string | null,"seller_completed_at"?: string | null,"seller_id"?: string,"status"?: string,"terms"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agreements_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agreements_closed_by_fkey"
      columns: ["closed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agreements_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agreements_offer_id_fkey"
      columns: ["offer_id"]
isOneToOne: true
      referencedRelation: "offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agreements_offered_product_id_fkey"
      columns: ["offered_product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agreements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agreements_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"appeals": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"moderation_action_id": string,"resolution_note": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"moderation_action_id": string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"moderation_action_id"?: string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appeals_moderation_action_id_fkey"
      columns: ["moderation_action_id"]
isOneToOne: false
      referencedRelation: "moderation_actions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appeals_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appeals_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"boutiques": {
                  Row: {
                    "created_at": string,"delivery_notes": string,"description": string,"owner_id": string,"payment_notes": string,"pickup_notes": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"delivery_notes"?: string,"description"?: string,"owner_id": string,"payment_notes"?: string,"pickup_notes"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"delivery_notes"?: string,"description"?: string,"owner_id"?: string,"payment_notes"?: string,"pickup_notes"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "boutiques_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "icon": string,"is_active": boolean,"name": string,"position": number,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "icon": string,"is_active"?: boolean,"name": string,"position": number,"slug": string
                  }
                  Update: {
                    "icon"?: string,"is_active"?: boolean,"name"?: string,"position"?: number,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"collections": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"owner_id": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"owner_id": string,"position"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"owner_id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "collections_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"deleted_at": string | null,"id": string,"moderation_status": Database["public"]['Enums']["moderation_state"],"parent_id": string | null,"post_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"moderation_status"?: Database["public"]['Enums']["moderation_state"],"parent_id"?: string | null,"post_id": string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"moderation_status"?: Database["public"]['Enums']["moderation_state"],"parent_id"?: string | null,"post_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"conversation_members": {
                  Row: {
                    "conversation_id": string,"hidden_at": string | null,"joined_at": string,"last_read_at": string,"muted": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"hidden_at"?: string | null,"joined_at"?: string,"last_read_at"?: string,"muted"?: boolean,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"hidden_at"?: string | null,"joined_at"?: string,"last_read_at"?: string,"muted"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_members_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"direct_key": string,"id": string,"last_message_at": string,"last_message_preview": string,"last_message_sender_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"direct_key": string,"id"?: string,"last_message_at"?: string,"last_message_preview"?: string,"last_message_sender_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"direct_key"?: string,"id"?: string,"last_message_at"?: string,"last_message_preview"?: string,"last_message_sender_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_last_message_sender_id_fkey"
      columns: ["last_message_sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"feature_flags": {
                  Row: {
                    "description": string,"enabled": boolean,"key": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string,"enabled"?: boolean,"key": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "description"?: string,"enabled"?: boolean,"key"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"feedback": {
                  Row: {
                    "app_version": string | null,"created_at": string,"id": string,"kind": string,"message": string,"platform": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "app_version"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"message": string,"platform"?: string,"status"?: string,"user_id"?: string
                  }
                  Update: {
                    "app_version"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"message"?: string,"platform"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "feedback_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"follows": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"followee_id": string,"follower_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"followee_id": string,"follower_id": string,"status"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"followee_id"?: string,"follower_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follows_followee_id_fkey"
      columns: ["followee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_follower_id_fkey"
      columns: ["follower_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"friend_requests": {
                  Row: {
                    "created_at": string,"id": string,"receiver_id": string,"responded_at": string | null,"sender_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"receiver_id": string,"responded_at"?: string | null,"sender_id": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"receiver_id"?: string,"responded_at"?: string | null,"sender_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "friend_requests_receiver_id_fkey"
      columns: ["receiver_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "friend_requests_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"friendships": {
                  Row: {
                    "created_at": string,"user_a": string,"user_b": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_a": string,"user_b": string
                  }
                  Update: {
                    "created_at"?: string,"user_a"?: string,"user_b"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "friendships_user_a_fkey"
      columns: ["user_a"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "friendships_user_b_fkey"
      columns: ["user_b"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"highlight_items": {
                  Row: {
                    "added_at": string,"highlight_id": string,"position": number,"story_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"highlight_id": string,"position"?: number,"story_id": string
                  }
                  Update: {
                    "added_at"?: string,"highlight_id"?: string,"position"?: number,"story_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "highlight_items_highlight_id_fkey"
      columns: ["highlight_id"]
isOneToOne: false
      referencedRelation: "highlights"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "highlight_items_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    }
                  ]
                },"highlights": {
                  Row: {
                    "created_at": string,"id": string,"owner_id": string,"position": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"owner_id": string,"position"?: number,"title": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"owner_id"?: string,"position"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "highlights_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"live_comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"live_session_id": string,"moderation_status": Database["public"]['Enums']["moderation_state"]
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string,"body": string,"created_at"?: string,"id"?: string,"live_session_id": string,"moderation_status"?: Database["public"]['Enums']["moderation_state"]
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"live_session_id"?: string,"moderation_status"?: Database["public"]['Enums']["moderation_state"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_comments_live_session_id_fkey"
      columns: ["live_session_id"]
isOneToOne: false
      referencedRelation: "live_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"live_mutes": {
                  Row: {
                    "created_at": string,"live_session_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"live_session_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"live_session_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_mutes_live_session_id_fkey"
      columns: ["live_session_id"]
isOneToOne: false
      referencedRelation: "live_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_mutes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"live_pins": {
                  Row: {
                    "id": string,"live_session_id": string,"pinned_at": string,"product_id": string,"unpinned_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"live_session_id": string,"pinned_at"?: string,"product_id": string,"unpinned_at"?: string | null
                  }
                  Update: {
                    "id"?: string,"live_session_id"?: string,"pinned_at"?: string,"product_id"?: string,"unpinned_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_pins_live_session_id_fkey"
      columns: ["live_session_id"]
isOneToOne: false
      referencedRelation: "live_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_pins_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"live_sessions": {
                  Row: {
                    "created_at": string,"ended_at": string | null,"host_id": string,"id": string,"moderation_status": Database["public"]['Enums']["moderation_state"],"peak_viewer_count": number | null,"provider": string,"provider_call_id": string,"provider_call_type": string,"started_at": string | null,"status": string,"title": string,"updated_at": string,"viewer_count": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ended_at"?: string | null,"host_id": string,"id"?: string,"moderation_status"?: Database["public"]['Enums']["moderation_state"],"peak_viewer_count"?: number | null,"provider"?: string,"provider_call_id": string,"provider_call_type"?: string,"started_at"?: string | null,"status"?: string,"title": string,"updated_at"?: string,"viewer_count"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"ended_at"?: string | null,"host_id"?: string,"id"?: string,"moderation_status"?: Database["public"]['Enums']["moderation_state"],"peak_viewer_count"?: number | null,"provider"?: string,"provider_call_id"?: string,"provider_call_type"?: string,"started_at"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string,"viewer_count"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_sessions_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "attachment_meta": NonNullable<Json>,"attachment_path": string | null,"body": string,"conversation_id": string,"created_at": string,"deleted_at": string | null,"id": string,"kind": string,"offer_id": string | null,"product_id": string | null,"sender_id": string,"story_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_meta"?: NonNullable<Json>,"attachment_path"?: string | null,"body"?: string,"conversation_id": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"kind"?: string,"offer_id"?: string | null,"product_id"?: string | null,"sender_id"?: string,"story_id"?: string | null
                  }
                  Update: {
                    "attachment_meta"?: NonNullable<Json>,"attachment_path"?: string | null,"body"?: string,"conversation_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"kind"?: string,"offer_id"?: string | null,"product_id"?: string | null,"sender_id"?: string,"story_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_offer_fk"
      columns: ["offer_id"]
isOneToOne: false
      referencedRelation: "offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_actions": {
                  Row: {
                    "action": string,"created_at": string,"id": string,"moderator_id": string | null,"reason": string,"report_id": string | null,"target_id": string,"target_owner_id": string | null,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"id"?: string,"moderator_id"?: string | null,"reason"?: string,"report_id"?: string | null,"target_id": string,"target_owner_id"?: string | null,"target_type": string
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"id"?: string,"moderator_id"?: string | null,"reason"?: string,"report_id"?: string | null,"target_id"?: string,"target_owner_id"?: string | null,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_actions_moderator_id_fkey"
      columns: ["moderator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_actions_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_actions_target_owner_id_fkey"
      columns: ["target_owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mutes": {
                  Row: {
                    "created_at": string,"muted_id": string,"muter_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"muted_id": string,"muter_id": string
                  }
                  Update: {
                    "created_at"?: string,"muted_id"?: string,"muter_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mutes_muted_id_fkey"
      columns: ["muted_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mutes_muter_id_fkey"
      columns: ["muter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"data": NonNullable<Json>,"entity_id": string | null,"entity_type": string | null,"id": string,"pushed_at": string | null,"read_at": string | null,"recipient_id": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"pushed_at"?: string | null,"read_at"?: string | null,"recipient_id": string,"type": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"pushed_at"?: string | null,"read_at"?: string | null,"recipient_id"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"offers": {
                  Row: {
                    "amount_xof": number | null,"buyer_id": string,"cash_payer": string | null,"conversation_id": string,"created_at": string,"expires_at": string,"id": string,"kind": string,"message": string,"offered_product_id": string | null,"parent_offer_id": string | null,"product_id": string | null,"proposer_id": string,"recipient_id": string,"responded_at": string | null,"seller_id": string,"snapshot": NonNullable<Json>,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_xof"?: number | null,"buyer_id": string,"cash_payer"?: string | null,"conversation_id": string,"created_at"?: string,"expires_at"?: string,"id"?: string,"kind": string,"message"?: string,"offered_product_id"?: string | null,"parent_offer_id"?: string | null,"product_id"?: string | null,"proposer_id": string,"recipient_id": string,"responded_at"?: string | null,"seller_id": string,"snapshot": NonNullable<Json>,"status"?: string
                  }
                  Update: {
                    "amount_xof"?: number | null,"buyer_id"?: string,"cash_payer"?: string | null,"conversation_id"?: string,"created_at"?: string,"expires_at"?: string,"id"?: string,"kind"?: string,"message"?: string,"offered_product_id"?: string | null,"parent_offer_id"?: string | null,"product_id"?: string | null,"proposer_id"?: string,"recipient_id"?: string,"responded_at"?: string | null,"seller_id"?: string,"snapshot"?: NonNullable<Json>,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "offers_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_offered_product_id_fkey"
      columns: ["offered_product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_parent_offer_id_fkey"
      columns: ["parent_offer_id"]
isOneToOne: false
      referencedRelation: "offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_proposer_id_fkey"
      columns: ["proposer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"post_media": {
                  Row: {
                    "bucket": string,"created_at": string,"cues": Json | null,"duration_ms": number | null,"height": number | null,"id": string,"kind": string,"language": string | null,"owner_id": string,"position": number,"post_id": string,"poster_path": string | null,"storage_path": string,"waveform": (number)[] | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket": string,"created_at"?: string,"cues"?: Json | null,"duration_ms"?: number | null,"height"?: number | null,"id"?: string,"kind": string,"language"?: string | null,"owner_id": string,"position"?: number,"post_id": string,"poster_path"?: string | null,"storage_path": string,"waveform"?: (number)[] | null,"width"?: number | null
                  }
                  Update: {
                    "bucket"?: string,"created_at"?: string,"cues"?: Json | null,"duration_ms"?: number | null,"height"?: number | null,"id"?: string,"kind"?: string,"language"?: string | null,"owner_id"?: string,"position"?: number,"post_id"?: string,"poster_path"?: string | null,"storage_path"?: string,"waveform"?: (number)[] | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_media_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_media_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"post_products": {
                  Row: {
                    "post_id": string,"product_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "post_id": string,"product_id": string
                  }
                  Update: {
                    "post_id"?: string,"product_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_products_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_products_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"post_saves": {
                  Row: {
                    "created_at": string,"post_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"post_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_saves_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_saves_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"post_votes": {
                  Row: {
                    "created_at": string,"post_id": string,"updated_at": string,"user_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"post_id": string,"updated_at"?: string,"user_id": string,"value": number
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"updated_at"?: string,"user_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_votes_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_votes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "author_id": string,"body": string,"city": string | null,"comment_count": number,"created_at": string,"deleted_at": string | null,"edited_at": string | null,"id": string,"intent": string,"kind": string,"moderation_status": Database["public"]['Enums']["moderation_state"],"pinned_at": string | null,"save_count": number,"updated_at": string,"upvote_count": number,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body"?: string,"city"?: string | null,"comment_count"?: number,"created_at"?: string,"deleted_at"?: string | null,"edited_at"?: string | null,"id"?: string,"intent"?: string,"kind"?: string,"moderation_status"?: Database["public"]['Enums']["moderation_state"],"pinned_at"?: string | null,"save_count"?: number,"updated_at"?: string,"upvote_count"?: number,"visibility"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"city"?: string | null,"comment_count"?: number,"created_at"?: string,"deleted_at"?: string | null,"edited_at"?: string | null,"id"?: string,"intent"?: string,"kind"?: string,"moderation_status"?: Database["public"]['Enums']["moderation_state"],"pinned_at"?: string | null,"save_count"?: number,"updated_at"?: string,"upvote_count"?: number,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"product_media": {
                  Row: {
                    "created_at": string,"cues": Json | null,"duration_ms": number | null,"height": number | null,"id": string,"kind": string,"language": string | null,"owner_id": string,"position": number,"poster_path": string | null,"product_id": string,"storage_path": string,"waveform": (number)[] | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"cues"?: Json | null,"duration_ms"?: number | null,"height"?: number | null,"id"?: string,"kind": string,"language"?: string | null,"owner_id": string,"position"?: number,"poster_path"?: string | null,"product_id": string,"storage_path": string,"waveform"?: (number)[] | null,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"cues"?: Json | null,"duration_ms"?: number | null,"height"?: number | null,"id"?: string,"kind"?: string,"language"?: string | null,"owner_id"?: string,"position"?: number,"poster_path"?: string | null,"product_id"?: string,"storage_path"?: string,"waveform"?: (number)[] | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_media_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_media_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_saves": {
                  Row: {
                    "created_at": string,"product_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"product_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"product_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_saves_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_saves_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "category_slug": string,"city": string | null,"collection_id": string | null,"condition": Database["public"]['Enums']["item_condition"],"created_at": string,"delivery_notes": string,"delivery_options": (string)[],"description": string,"id": string,"listing_mode": Database["public"]['Enums']["listing_mode"],"moderation_status": Database["public"]['Enums']["moderation_state"],"neighborhood": string | null,"pinned_at": string | null,"price_mode": string,"price_xof": number | null,"quantity": number,"save_count": number,"search_text": string | null,"seller_id": string,"sold_at": string | null,"status": Database["public"]['Enums']["product_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_slug": string,"city"?: string | null,"collection_id"?: string | null,"condition"?: Database["public"]['Enums']["item_condition"],"created_at"?: string,"delivery_notes"?: string,"delivery_options"?: (string)[],"description"?: string,"id"?: string,"listing_mode"?: Database["public"]['Enums']["listing_mode"],"moderation_status"?: Database["public"]['Enums']["moderation_state"],"neighborhood"?: string | null,"pinned_at"?: string | null,"price_mode"?: string,"price_xof"?: number | null,"quantity"?: number,"save_count"?: number,"search_text"?: never,"seller_id": string,"sold_at"?: string | null,"status"?: Database["public"]['Enums']["product_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "category_slug"?: string,"city"?: string | null,"collection_id"?: string | null,"condition"?: Database["public"]['Enums']["item_condition"],"created_at"?: string,"delivery_notes"?: string,"delivery_options"?: (string)[],"description"?: string,"id"?: string,"listing_mode"?: Database["public"]['Enums']["listing_mode"],"moderation_status"?: Database["public"]['Enums']["moderation_state"],"neighborhood"?: string | null,"pinned_at"?: string | null,"price_mode"?: string,"price_xof"?: number | null,"quantity"?: number,"save_count"?: number,"search_text"?: never,"seller_id"?: string,"sold_at"?: string | null,"status"?: Database["public"]['Enums']["product_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_slug_fkey"
      columns: ["category_slug"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "products_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "collections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "adult_confirmed_at": string | null,"avatar_path": string | null,"bio": string,"boutique_category_slug": string | null,"boutique_name": string | null,"city": string | null,"cover_path": string | null,"created_at": string,"display_name": string,"followers_count": number,"following_count": number,"friends_count": number,"handle": string,"id": string,"interests": (string)[],"is_demo": boolean,"is_merchant": boolean,"is_private": boolean,"neighborhood": string | null,"onboarded_at": string | null,"posts_count": number,"products_count": number,"rating_count": number,"rating_sum": number,"status": Database["public"]['Enums']["account_status"],"updated_at": string,"verification_level": Database["public"]['Enums']["verification_level"]
                  }
                  ComputedFields: never
                  Insert: {
                    "adult_confirmed_at"?: string | null,"avatar_path"?: string | null,"bio"?: string,"boutique_category_slug"?: string | null,"boutique_name"?: string | null,"city"?: string | null,"cover_path"?: string | null,"created_at"?: string,"display_name": string,"followers_count"?: number,"following_count"?: number,"friends_count"?: number,"handle": string,"id": string,"interests"?: (string)[],"is_demo"?: boolean,"is_merchant"?: boolean,"is_private"?: boolean,"neighborhood"?: string | null,"onboarded_at"?: string | null,"posts_count"?: number,"products_count"?: number,"rating_count"?: number,"rating_sum"?: number,"status"?: Database["public"]['Enums']["account_status"],"updated_at"?: string,"verification_level"?: Database["public"]['Enums']["verification_level"]
                  }
                  Update: {
                    "adult_confirmed_at"?: string | null,"avatar_path"?: string | null,"bio"?: string,"boutique_category_slug"?: string | null,"boutique_name"?: string | null,"city"?: string | null,"cover_path"?: string | null,"created_at"?: string,"display_name"?: string,"followers_count"?: number,"following_count"?: number,"friends_count"?: number,"handle"?: string,"id"?: string,"interests"?: (string)[],"is_demo"?: boolean,"is_merchant"?: boolean,"is_private"?: boolean,"neighborhood"?: string | null,"onboarded_at"?: string | null,"posts_count"?: number,"products_count"?: number,"rating_count"?: number,"rating_sum"?: number,"status"?: Database["public"]['Enums']["account_status"],"updated_at"?: string,"verification_level"?: Database["public"]['Enums']["verification_level"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_boutique_category_slug_fkey"
      columns: ["boutique_category_slug"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["slug"]
    }
                  ]
                },"prohibited_terms": {
                  Row: {
                    "created_at": string,"reason": string,"term": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"reason": string,"term": string
                  }
                  Update: {
                    "created_at"?: string,"reason"?: string,"term"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_tokens": {
                  Row: {
                    "created_at": string,"platform": string,"token": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"platform": string,"token": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"platform"?: string,"token"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"details": string,"evidence": NonNullable<Json>,"id": string,"reason": string,"reporter_id": string,"resolution_note": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": string,"target_id": string,"target_owner_id": string | null,"target_type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string,"evidence"?: NonNullable<Json>,"id"?: string,"reason": string,"reporter_id": string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"target_id": string,"target_owner_id"?: string | null,"target_type": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"details"?: string,"evidence"?: NonNullable<Json>,"id"?: string,"reason"?: string,"reporter_id"?: string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"target_id"?: string,"target_owner_id"?: string | null,"target_type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_target_owner_id_fkey"
      columns: ["target_owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reserved_handles": {
                  Row: {
                    "handle": string
                  }
                  ComputedFields: never
                  Insert: {
                    "handle": string
                  }
                  Update: {
                    "handle"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reviews": {
                  Row: {
                    "agreement_id": string,"body": string,"created_at": string,"id": string,"moderation_status": Database["public"]['Enums']["moderation_state"],"rating": number,"reviewee_id": string,"reviewer_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agreement_id": string,"body"?: string,"created_at"?: string,"id"?: string,"moderation_status"?: Database["public"]['Enums']["moderation_state"],"rating": number,"reviewee_id": string,"reviewer_id": string
                  }
                  Update: {
                    "agreement_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"moderation_status"?: Database["public"]['Enums']["moderation_state"],"rating"?: number,"reviewee_id"?: string,"reviewer_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_agreement_id_fkey"
      columns: ["agreement_id"]
isOneToOne: false
      referencedRelation: "agreements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_reviewee_id_fkey"
      columns: ["reviewee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_roles": {
                  Row: {
                    "created_at": string,"granted_by": string | null,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"granted_by"?: string | null,"role": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"granted_by"?: string | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"stories": {
                  Row: {
                    "audience": string,"author_id": string,"caption": string,"created_at": string,"deleted_at": string | null,"duration_ms": number | null,"expires_at": string,"height": number | null,"id": string,"media_kind": string,"moderation_status": Database["public"]['Enums']["moderation_state"],"post_id": string | null,"poster_path": string | null,"product_id": string | null,"storage_path": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "audience": string,"author_id": string,"caption"?: string,"created_at"?: string,"deleted_at"?: string | null,"duration_ms"?: number | null,"expires_at"?: string,"height"?: number | null,"id"?: string,"media_kind": string,"moderation_status"?: Database["public"]['Enums']["moderation_state"],"post_id"?: string | null,"poster_path"?: string | null,"product_id"?: string | null,"storage_path"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "audience"?: string,"author_id"?: string,"caption"?: string,"created_at"?: string,"deleted_at"?: string | null,"duration_ms"?: number | null,"expires_at"?: string,"height"?: number | null,"id"?: string,"media_kind"?: string,"moderation_status"?: Database["public"]['Enums']["moderation_state"],"post_id"?: string | null,"poster_path"?: string | null,"product_id"?: string | null,"storage_path"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stories_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stories_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stories_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"story_likes": {
                  Row: {
                    "created_at": string,"story_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"story_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"story_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "story_likes_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "story_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"story_views": {
                  Row: {
                    "story_id": string,"viewed_at": string,"viewer_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "story_id": string,"viewed_at"?: string,"viewer_id": string
                  }
                  Update: {
                    "story_id"?: string,"viewed_at"?: string,"viewer_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "story_views_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "story_views_viewer_id_fkey"
      columns: ["viewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"verification_requests": {
                  Row: {
                    "business_name": string,"business_type": string,"created_at": string,"details": string,"id": string,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_name": string,"business_type": string,"created_at"?: string,"details"?: string,"id"?: string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "business_name"?: string,"business_type"?: string,"created_at"?: string,"details"?: string,"id"?: string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "verification_requests_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "active_cities":
{ Args: { "p_limit"?: number }; Returns: {
              "city": string,"listings": number
            }[]
                           },
"admin_audit_log":
{ Args: { "p_limit"?: number }; Returns: unknown[]
                          SetofOptions: {
        from: "*"
        to: "audit_events"
        isOneToOne: false
        isSetofReturn: true
      } },
"admin_set_feature_flag":
{ Args: { "p_enabled": boolean,"p_key": string }; Returns: undefined
                           },
"admin_sms_usage":
{ Args: { "p_days"?: number }; Returns: {
              "blocked": number,"blocked_by_reason": Json,"day": string,"est_cost_xof": number,"failed": number,"pending": number,"sent": number,"sent_by_prefix": Json
            }[]
                           },
"browse_products":
{ Args: { "p_category"?: string,"p_city"?: string,"p_condition"?: string,"p_limit"?: number,"p_mode"?: string,"p_offset"?: number,"p_query"?: string }; Returns: {
              "category_slug": string,
"city": string | null,
"collection_id": string | null,
"condition": Database["public"]['Enums']["item_condition"],
"created_at": string,
"delivery_notes": string,
"delivery_options": (string)[],
"description": string,
"id": string,
"listing_mode": Database["public"]['Enums']["listing_mode"],
"moderation_status": Database["public"]['Enums']["moderation_state"],
"neighborhood": string | null,
"pinned_at": string | null,
"price_mode": string,
"price_xof": number | null,
"quantity": number,
"save_count": number,
"search_text": string | null,
"seller_id": string,
"sold_at": string | null,
"status": Database["public"]['Enums']["product_status"],
"title": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "products"
        isOneToOne: false
        isSetofReturn: true
      } },
"cancel_friend_request":
{ Args: { "p_request_id": string }; Returns: undefined
                           },
"close_agreement":
{ Args: { "p_agreement_id": string,"p_outcome": string,"p_reason": string }; Returns: undefined
                           },
"confirm_agreement_completed":
{ Args: { "p_agreement_id": string }; Returns: string
                           },
"counter_offer":
{ Args: { "p_amount_xof": number,"p_cash_payer"?: string,"p_message"?: string,"p_offer_id": string,"p_offered_product_id"?: string }; Returns: string
                           },
"create_listing":
{ Args: { "p_category_slug": string,"p_city": string,"p_collection_id"?: string,"p_condition": Database["public"]['Enums']["item_condition"],"p_delivery_notes": string,"p_delivery_options": (string)[],"p_description": string,"p_listing_mode": Database["public"]['Enums']["listing_mode"],"p_media": Json,"p_neighborhood": string,"p_price_mode"?: string,"p_price_xof": number,"p_quantity": number,"p_title": string }; Returns: string
                           },
"create_post":
{ Args: { "p_body": string,"p_intent"?: string,"p_media": Json,"p_product_ids"?: (string)[],"p_visibility": string }; Returns: string
                           },
"create_story":
{ Args: { "p_audience": string,"p_caption": string,"p_duration_ms": number,"p_height": number,"p_media_kind": string,"p_path": string,"p_poster_path": string,"p_product_id"?: string,"p_width": number }; Returns: string
                           },
"delete_comment":
{ Args: { "p_comment_id": string }; Returns: undefined
                           },
"delete_post":
{ Args: { "p_post_id": string }; Returns: undefined
                           },
"delete_story":
{ Args: { "p_story_id": string }; Returns: undefined
                           },
"expire_stale_offers":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"explore_products":
{ Args: { "p_category"?: string,"p_city"?: string,"p_condition"?: string,"p_limit"?: number,"p_max_price"?: number,"p_min_price"?: number,"p_mode"?: string,"p_offer"?: string,"p_offset"?: number,"p_query"?: string,"p_sort"?: string }; Returns: {
              "category_slug": string,
"city": string | null,
"collection_id": string | null,
"condition": Database["public"]['Enums']["item_condition"],
"created_at": string,
"delivery_notes": string,
"delivery_options": (string)[],
"description": string,
"id": string,
"listing_mode": Database["public"]['Enums']["listing_mode"],
"moderation_status": Database["public"]['Enums']["moderation_state"],
"neighborhood": string | null,
"pinned_at": string | null,
"price_mode": string,
"price_xof": number | null,
"quantity": number,
"save_count": number,
"search_text": string | null,
"seller_id": string,
"sold_at": string | null,
"status": Database["public"]['Enums']["product_status"],
"title": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "products"
        isOneToOne: false
        isSetofReturn: true
      } },
"export_my_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_comment_previews":
{ Args: { "p_per_post"?: number,"p_post_ids": (string)[] }; Returns: {
              "author": Json,"body": string,"by_post_author": boolean,"comment_id": string,"created_at": string,"post_id": string
            }[]
                           },
"get_feed":
{ Args: { "p_before"?: string,"p_limit"?: number,"p_offset"?: number,"p_tab"?: string }; Returns: {
              "created_at": string,"post_id": string,"reason": string,"score": number
            }[]
                           },
"get_or_create_conversation":
{ Args: { "p_other": string }; Returns: string
                           },
"get_story_rail":
{ Args: Record<PropertyKey, never>; Returns: {
              "author_id": string,"has_unseen": boolean,"latest_at": string,"story_count": number
            }[]
                           },
"hide_live_comment":
{ Args: { "p_comment_id": string }; Returns: undefined
                           },
"leave_review":
{ Args: { "p_agreement_id": string,"p_body": string,"p_rating": number }; Returns: string
                           },
"list_orphaned_media":
{ Args: { "p_limit"?: number,"p_min_age"?: string }; Returns: {
              "bucket_id": string,"name": string
            }[]
                           },
"live_apply_provider_state":
{ Args: { "p_provider_call_id": string,"p_status": string,"p_viewer_count"?: number }; Returns: undefined
                           },
"make_offer":
{ Args: { "p_amount_xof": number,"p_cash_payer"?: string,"p_kind": string,"p_message"?: string,"p_offered_product_id"?: string,"p_product_id": string }; Returns: string
                           },
"mark_all_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"message_about_product":
{ Args: { "p_body"?: string,"p_product_id": string }; Returns: string
                           },
"moderate":
{ Args: { "p_action": string,"p_reason"?: string,"p_report_id"?: string,"p_target_id": string,"p_target_type": string }; Returns: string
                           },
"mute_in_live":
{ Args: { "p_mute": boolean,"p_session_id": string,"p_user_id": string }; Returns: undefined
                           },
"my_conversations":
{ Args: Record<PropertyKey, never>; Returns: {
              "conversation_id": string,"last_message_at": string,"last_message_preview": string,"last_message_sender_id": string,"muted": boolean,"other_last_read_at": string,"other_user_id": string,"unread_count": number
            }[]
                           },
"my_staff_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"pin_live_product":
{ Args: { "p_product_id": string,"p_session_id": string }; Returns: undefined
                           },
"purge_expired_stories":
{ Args: Record<PropertyKey, never>; Returns: {
              "poster_path": string,"storage_path": string
            }[]
                           },
"register_push_token":
{ Args: { "p_platform": string,"p_token": string }; Returns: undefined
                           },
"relationship_with":
{ Args: { "p_target": string }; Returns: Json
                           },
"remove_friend":
{ Args: { "p_other": string }; Returns: undefined
                           },
"reply_to_story":
{ Args: { "p_body": string,"p_story_id": string }; Returns: string
                           },
"report_content":
{ Args: { "p_details"?: string,"p_reason": string,"p_target_id": string,"p_target_type": string }; Returns: string
                           },
"resolve_appeal":
{ Args: { "p_appeal_id": string,"p_note": string,"p_reverse": boolean }; Returns: undefined
                           },
"respond_friend_request":
{ Args: { "p_accept": boolean,"p_request_id": string }; Returns: string
                           },
"respond_offer":
{ Args: { "p_accept": boolean,"p_offer_id": string }; Returns: string
                           },
"review_verification_request":
{ Args: { "p_approve": boolean,"p_note": string,"p_request_id": string }; Returns: undefined
                           },
"search_profiles":
{ Args: { "p_city"?: string,"p_limit"?: number,"p_query": string }; Returns: {
              "adult_confirmed_at": string | null,
"avatar_path": string | null,
"bio": string,
"boutique_category_slug": string | null,
"boutique_name": string | null,
"city": string | null,
"cover_path": string | null,
"created_at": string,
"display_name": string,
"followers_count": number,
"following_count": number,
"friends_count": number,
"handle": string,
"id": string,
"interests": (string)[],
"is_demo": boolean,
"is_merchant": boolean,
"is_private": boolean,
"neighborhood": string | null,
"onboarded_at": string | null,
"posts_count": number,
"products_count": number,
"rating_count": number,
"rating_sum": number,
"status": Database["public"]['Enums']["account_status"],
"updated_at": string,
"verification_level": Database["public"]['Enums']["verification_level"]
            }[]
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: false
        isSetofReturn: true
      } },
"send_friend_request":
{ Args: { "p_target": string }; Returns: string
                           },
"set_listing_media":
{ Args: { "p_media": Json,"p_product_id": string }; Returns: undefined
                           },
"set_pinned":
{ Args: { "p_id": string,"p_kind": string,"p_pinned": boolean }; Returns: undefined
                           },
"set_report_status":
{ Args: { "p_report_id": string,"p_status": string }; Returns: undefined
                           },
"share_to_status":
{ Args: { "p_audience"?: string,"p_caption"?: string,"p_post_id"?: string,"p_product_id"?: string }; Returns: string
                           },
"sms_hook_begin":
{ Args: { "p_hook_id": string,"p_ip_key"?: string,"p_phone_key": string,"p_phone_prefix": string,"p_user_id"?: string }; Returns: Json
                           },
"sms_hook_finish":
{ Args: { "p_event_id": number,"p_outcome": string,"p_provider": string,"p_provider_ref"?: string,"p_reason"?: string }; Returns: undefined
                           },
"submit_appeal":
{ Args: { "p_body": string,"p_moderation_action_id": string }; Returns: string
                           },
"suggested_sellers":
{ Args: { "p_limit"?: number }; Returns: {
              "active_products": number,"avatar_path": string,"boutique_name": string,"city": string,"display_name": string,"handle": string,"id": string,"is_demo": boolean,"verification_level": Database["public"]['Enums']["verification_level"]
            }[]
                           },
"trending_products":
{ Args: { "p_days"?: number,"p_limit"?: number }; Returns: {
              "category_slug": string,
"city": string | null,
"collection_id": string | null,
"condition": Database["public"]['Enums']["item_condition"],
"created_at": string,
"delivery_notes": string,
"delivery_options": (string)[],
"description": string,
"id": string,
"listing_mode": Database["public"]['Enums']["listing_mode"],
"moderation_status": Database["public"]['Enums']["moderation_state"],
"neighborhood": string | null,
"pinned_at": string | null,
"price_mode": string,
"price_xof": number | null,
"quantity": number,
"save_count": number,
"search_text": string | null,
"seller_id": string,
"sold_at": string | null,
"status": Database["public"]['Enums']["product_status"],
"title": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "products"
        isOneToOne: false
        isSetofReturn: true
      } },
"unpin_live_product":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"unread_messages_count":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"vote_post":
{ Args: { "p_post_id": string,"p_value": number }; Returns: Json
                           },
"withdraw_offer":
{ Args: { "p_offer_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "account_status": "active"|"suspended","item_condition": "new"|"like_new"|"very_good"|"good"|"fair"|"refurbished","listing_mode": "sale"|"trade"|"sale_or_trade","moderation_state": "active"|"hidden"|"removed","product_status": "active"|"reserved"|"sold"|"archived","verification_level": "none"|"merchant_verified"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "account_status": ["active", "suspended"],"item_condition": ["new", "like_new", "very_good", "good", "fair", "refurbished"],"listing_mode": ["sale", "trade", "sale_or_trade"],"moderation_state": ["active", "hidden", "removed"],"product_status": ["active", "reserved", "sold", "archived"],"verification_level": ["none", "merchant_verified"]
          }
        }
} as const
