
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "argument_ratings": {
                  Row: {
                    "argument_id": string,"created_at": string,"rater_pseudo": string,"useful": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "argument_id": string,"created_at"?: string,"rater_pseudo": string,"useful": boolean
                  }
                  Update: {
                    "argument_id"?: string,"created_at"?: string,"rater_pseudo"?: string,"useful"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "argument_ratings_argument_id_fkey"
      columns: ["argument_id"]
isOneToOne: false
      referencedRelation: "arguments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "argument_ratings_argument_id_fkey"
      columns: ["argument_id"]
isOneToOne: false
      referencedRelation: "arguments_public"
      referencedColumns: ["id"]
    }
                  ]
                },"arguments": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"cross_utility": number | null,"id": string,"proposal_id": string,"side": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"cross_utility"?: number | null,"id"?: string,"proposal_id": string,"side": string,"status"?: string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"cross_utility"?: number | null,"id"?: string,"proposal_id"?: string,"side"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "arguments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "arguments_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "proposals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "arguments_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "proposals_public"
      referencedColumns: ["id"]
    }
                  ]
                },"bar_messages": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"depth": number,"expires_at": string,"id": string,"parent_id": string | null,"status": string,"topic_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"depth"?: number,"expires_at": string,"id"?: string,"parent_id"?: string | null,"status"?: string,"topic_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"depth"?: number,"expires_at"?: string,"id"?: string,"parent_id"?: string | null,"status"?: string,"topic_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bar_messages_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bar_messages_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "bar_messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bar_messages_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "bar_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bar_messages_topic_id_fkey"
      columns: ["topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                },"config_changelog": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"id": number,"key": string,"new_value": NonNullable<Json>,"old_value": Json | null,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"id"?: never,"key": string,"new_value": NonNullable<Json>,"old_value"?: Json | null,"reason": string
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"id"?: never,"key"?: string,"new_value"?: NonNullable<Json>,"old_value"?: Json | null,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "config_changelog_key_fkey"
      columns: ["key"]
isOneToOne: false
      referencedRelation: "platform_config"
      referencedColumns: ["key"]
    }
                  ]
                },"filter_block_stats": {
                  Row: {
                    "content_type": string,"count": number,"day": string,"level": number
                  }
                  ComputedFields: never
                  Insert: {
                    "content_type": string,"count"?: number,"day": string,"level": number
                  }
                  Update: {
                    "content_type"?: string,"count"?: number,"day"?: string,"level"?: number
                  }
                  Relationships: [
                    
                  ]
                },"lexicon_terms": {
                  Row: {
                    "created_at": string,"id": string,"is_pattern": boolean,"level": number,"notes": string | null,"term": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_pattern"?: boolean,"level": number,"notes"?: string | null,"term": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_pattern"?: boolean,"level"?: number,"notes"?: string | null,"term"?: string
                  }
                  Relationships: [
                    
                  ]
                },"piazza_messages": {
                  Row: {
                    "author_id": string | null,"body": string,"bridging_score": number | null,"created_at": string,"depth": number,"id": string,"parent_id": string | null,"problem_id": string | null,"status": string,"topic_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"bridging_score"?: number | null,"created_at"?: string,"depth"?: number,"id"?: string,"parent_id"?: string | null,"problem_id"?: string | null,"status"?: string,"topic_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"bridging_score"?: number | null,"created_at"?: string,"depth"?: number,"id"?: string,"parent_id"?: string | null,"problem_id"?: string | null,"status"?: string,"topic_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "piazza_messages_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piazza_messages_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "piazza_messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piazza_messages_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "piazza_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piazza_messages_problem_id_fkey"
      columns: ["problem_id"]
isOneToOne: false
      referencedRelation: "problems"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piazza_messages_problem_id_fkey"
      columns: ["problem_id"]
isOneToOne: false
      referencedRelation: "problems_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piazza_messages_topic_id_fkey"
      columns: ["topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                },"piazza_votes": {
                  Row: {
                    "created_at": string,"message_id": string,"updated_at": string,"value": number,"voter_pseudo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"message_id": string,"updated_at"?: string,"value": number,"voter_pseudo": string
                  }
                  Update: {
                    "created_at"?: string,"message_id"?: string,"updated_at"?: string,"value"?: number,"voter_pseudo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "piazza_votes_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "piazza_messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piazza_votes_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "piazza_public"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_config": {
                  Row: {
                    "description": string | null,"key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"key": string,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"problem_facts": {
                  Row: {
                    "created_at": string,"id": string,"problem_id": string,"proposed_by": string | null,"reviewed_by": string | null,"source_id": string,"statement": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"problem_id": string,"proposed_by"?: string | null,"reviewed_by"?: string | null,"source_id": string,"statement": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"problem_id"?: string,"proposed_by"?: string | null,"reviewed_by"?: string | null,"source_id"?: string,"statement"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "problem_facts_problem_id_fkey"
      columns: ["problem_id"]
isOneToOne: false
      referencedRelation: "problems"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "problem_facts_problem_id_fkey"
      columns: ["problem_id"]
isOneToOne: false
      referencedRelation: "problems_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "problem_facts_proposed_by_fkey"
      columns: ["proposed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "problem_facts_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "problem_facts_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "sources"
      referencedColumns: ["id"]
    }
                  ]
                },"problem_reformulation_votes": {
                  Row: {
                    "created_at": string,"reformulation_id": string,"updated_at": string,"value": number,"voter_pseudo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"reformulation_id": string,"updated_at"?: string,"value": number,"voter_pseudo": string
                  }
                  Update: {
                    "created_at"?: string,"reformulation_id"?: string,"updated_at"?: string,"value"?: number,"voter_pseudo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "problem_reformulation_votes_reformulation_id_fkey"
      columns: ["reformulation_id"]
isOneToOne: false
      referencedRelation: "problem_reformulations"
      referencedColumns: ["id"]
    }
                  ]
                },"problem_reformulations": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"id": string,"problem_id": string,"status": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"id"?: string,"problem_id": string,"status"?: string,"title": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"problem_id"?: string,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "problem_reformulations_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "problem_reformulations_problem_id_fkey"
      columns: ["problem_id"]
isOneToOne: false
      referencedRelation: "problems"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "problem_reformulations_problem_id_fkey"
      columns: ["problem_id"]
isOneToOne: false
      referencedRelation: "problems_public"
      referencedColumns: ["id"]
    }
                  ]
                },"problem_supports": {
                  Row: {
                    "created_at": string,"problem_id": string,"voter_pseudo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"problem_id": string,"voter_pseudo": string
                  }
                  Update: {
                    "created_at"?: string,"problem_id"?: string,"voter_pseudo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "problem_supports_problem_id_fkey"
      columns: ["problem_id"]
isOneToOne: false
      referencedRelation: "problems"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "problem_supports_problem_id_fkey"
      columns: ["problem_id"]
isOneToOne: false
      referencedRelation: "problems_public"
      referencedColumns: ["id"]
    }
                  ]
                },"problems": {
                  Row: {
                    "activated_at": string | null,"affected": string,"author_id": string | null,"body": string,"created_at": string,"id": string,"merged_into": string | null,"status": string,"title": string,"topic_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"affected": string,"author_id"?: string | null,"body": string,"created_at"?: string,"id"?: string,"merged_into"?: string | null,"status"?: string,"title": string,"topic_id": string
                  }
                  Update: {
                    "activated_at"?: string | null,"affected"?: string,"author_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"merged_into"?: string | null,"status"?: string,"title"?: string,"topic_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "problems_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "problems_merged_into_fkey"
      columns: ["merged_into"]
isOneToOne: false
      referencedRelation: "problems"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "problems_merged_into_fkey"
      columns: ["merged_into"]
isOneToOne: false
      referencedRelation: "problems_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "problems_topic_id_fkey"
      columns: ["topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "adult_declared_at": string | null,"consent_art9_at": string | null,"created_at": string,"deleted_at": string | null,"handle": string | null,"id": string,"rules_version_accepted": string | null,"status": string,"suspended_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "adult_declared_at"?: string | null,"consent_art9_at"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"handle"?: string | null,"id": string,"rules_version_accepted"?: string | null,"status"?: string,"suspended_until"?: string | null
                  }
                  Update: {
                    "adult_declared_at"?: string | null,"consent_art9_at"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"handle"?: string | null,"id"?: string,"rules_version_accepted"?: string | null,"status"?: string,"suspended_until"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"proposal_votes": {
                  Row: {
                    "proposal_id": string,"updated_at": string,"value": number,"voted_at": string,"voter_pseudo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "proposal_id": string,"updated_at"?: string,"value": number,"voted_at"?: string,"voter_pseudo": string
                  }
                  Update: {
                    "proposal_id"?: string,"updated_at"?: string,"value"?: number,"voted_at"?: string,"voter_pseudo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "proposal_votes_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "proposals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposal_votes_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "proposals_public"
      referencedColumns: ["id"]
    }
                  ]
                },"proposals": {
                  Row: {
                    "author_id": string | null,"cost_and_funding": string,"created_at": string,"foreign_example": string | null,"foreign_source_id": string | null,"how": string,"id": string,"origin": string,"origin_message_id": string | null,"problem_id": string,"risks": string,"status": string,"what": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"cost_and_funding": string,"created_at"?: string,"foreign_example"?: string | null,"foreign_source_id"?: string | null,"how": string,"id"?: string,"origin"?: string,"origin_message_id"?: string | null,"problem_id": string,"risks": string,"status"?: string,"what": string
                  }
                  Update: {
                    "author_id"?: string | null,"cost_and_funding"?: string,"created_at"?: string,"foreign_example"?: string | null,"foreign_source_id"?: string | null,"how"?: string,"id"?: string,"origin"?: string,"origin_message_id"?: string | null,"problem_id"?: string,"risks"?: string,"status"?: string,"what"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "proposals_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposals_foreign_source_id_fkey"
      columns: ["foreign_source_id"]
isOneToOne: false
      referencedRelation: "sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposals_origin_message_id_fkey"
      columns: ["origin_message_id"]
isOneToOne: false
      referencedRelation: "piazza_messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposals_origin_message_id_fkey"
      columns: ["origin_message_id"]
isOneToOne: false
      referencedRelation: "piazza_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposals_problem_id_fkey"
      columns: ["problem_id"]
isOneToOne: false
      referencedRelation: "problems"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposals_problem_id_fkey"
      columns: ["problem_id"]
isOneToOne: false
      referencedRelation: "problems_public"
      referencedColumns: ["id"]
    }
                  ]
                },"sources": {
                  Row: {
                    "added_by": string | null,"created_at": string,"id": string,"kind": string,"publisher": string | null,"title": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"publisher"?: string | null,"title": string,"url": string
                  }
                  Update: {
                    "added_by"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"publisher"?: string | null,"title"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sources_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"topics": {
                  Row: {
                    "description": string | null,"id": string,"is_active": boolean,"selection_criterion": string,"slug": string,"sort": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"id"?: string,"is_active"?: boolean,"selection_criterion": string,"slug": string,"sort"?: number,"title": string
                  }
                  Update: {
                    "description"?: string | null,"id"?: string,"is_active"?: boolean,"selection_criterion"?: string,"slug"?: string,"sort"?: number,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "argument_utility": {
                  Row: {
                    "argument_id": string | null,"below_threshold": boolean | null,"not_useful": number | null,"total": number | null,"useful": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "argument_ratings_argument_id_fkey"
      columns: ["argument_id"]
isOneToOne: false
      referencedRelation: "arguments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "argument_ratings_argument_id_fkey"
      columns: ["argument_id"]
isOneToOne: false
      referencedRelation: "arguments_public"
      referencedColumns: ["id"]
    }
                  ]
                },"arguments_public": {
                  Row: {
                    "body": string | null,"created_at": string | null,"cross_utility": number | null,"id": string | null,"proposal_id": string | null,"side": string | null,"status": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "body"?: string | null,"created_at"?: string | null,"cross_utility"?: number | null,"id"?: string | null,"proposal_id"?: string | null,"side"?: string | null,"status"?: string | null
                         }
                        Update: {
                           "body"?: string | null,"created_at"?: string | null,"cross_utility"?: number | null,"id"?: string | null,"proposal_id"?: string | null,"side"?: string | null,"status"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "arguments_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "proposals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "arguments_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "proposals_public"
      referencedColumns: ["id"]
    }
                  ]
                },"bar_public": {
                  Row: {
                    "body": string | null,"created_at": string | null,"depth": number | null,"expires_at": string | null,"handle": string | null,"id": string | null,"parent_id": string | null,"status": string | null,"topic_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "bar_messages_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "bar_messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bar_messages_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "bar_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bar_messages_topic_id_fkey"
      columns: ["topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                },"piazza_public": {
                  Row: {
                    "body": string | null,"bridging_score": number | null,"created_at": string | null,"depth": number | null,"handle": string | null,"id": string | null,"parent_id": string | null,"problem_id": string | null,"status": string | null,"topic_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "piazza_messages_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "piazza_messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piazza_messages_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "piazza_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piazza_messages_problem_id_fkey"
      columns: ["problem_id"]
isOneToOne: false
      referencedRelation: "problems"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piazza_messages_problem_id_fkey"
      columns: ["problem_id"]
isOneToOne: false
      referencedRelation: "problems_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piazza_messages_topic_id_fkey"
      columns: ["topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                },"piazza_tallies": {
                  Row: {
                    "agree": number | null,"below_threshold": boolean | null,"disagree": number | null,"message_id": string | null,"pass": number | null,"total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "piazza_votes_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "piazza_messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piazza_votes_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "piazza_public"
      referencedColumns: ["id"]
    }
                  ]
                },"problems_public": {
                  Row: {
                    "activated_at": string | null,"affected": string | null,"body": string | null,"created_at": string | null,"id": string | null,"merged_into": string | null,"status": string | null,"title": string | null,"topic_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "activated_at"?: string | null,"affected"?: string | null,"body"?: string | null,"created_at"?: string | null,"id"?: string | null,"merged_into"?: string | null,"status"?: string | null,"title"?: string | null,"topic_id"?: string | null
                         }
                        Update: {
                           "activated_at"?: string | null,"affected"?: string | null,"body"?: string | null,"created_at"?: string | null,"id"?: string | null,"merged_into"?: string | null,"status"?: string | null,"title"?: string | null,"topic_id"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "problems_merged_into_fkey"
      columns: ["merged_into"]
isOneToOne: false
      referencedRelation: "problems"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "problems_merged_into_fkey"
      columns: ["merged_into"]
isOneToOne: false
      referencedRelation: "problems_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "problems_topic_id_fkey"
      columns: ["topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                },"proposal_tallies": {
                  Row: {
                    "agree": number | null,"below_threshold": boolean | null,"disagree": number | null,"pass": number | null,"proposal_id": string | null,"total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "proposal_votes_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "proposals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposal_votes_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "proposals_public"
      referencedColumns: ["id"]
    }
                  ]
                },"proposals_public": {
                  Row: {
                    "cost_and_funding": string | null,"created_at": string | null,"foreign_example": string | null,"foreign_source_id": string | null,"how": string | null,"id": string | null,"origin": string | null,"origin_message_id": string | null,"problem_id": string | null,"risks": string | null,"status": string | null,"what": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "cost_and_funding"?: string | null,"created_at"?: string | null,"foreign_example"?: string | null,"foreign_source_id"?: string | null,"how"?: string | null,"id"?: string | null,"origin"?: string | null,"origin_message_id"?: string | null,"problem_id"?: string | null,"risks"?: string | null,"status"?: string | null,"what"?: string | null
                         }
                        Update: {
                           "cost_and_funding"?: string | null,"created_at"?: string | null,"foreign_example"?: string | null,"foreign_source_id"?: string | null,"how"?: string | null,"id"?: string | null,"origin"?: string | null,"origin_message_id"?: string | null,"problem_id"?: string | null,"risks"?: string | null,"status"?: string | null,"what"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "proposals_foreign_source_id_fkey"
      columns: ["foreign_source_id"]
isOneToOne: false
      referencedRelation: "sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposals_origin_message_id_fkey"
      columns: ["origin_message_id"]
isOneToOne: false
      referencedRelation: "piazza_messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposals_origin_message_id_fkey"
      columns: ["origin_message_id"]
isOneToOne: false
      referencedRelation: "piazza_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposals_problem_id_fkey"
      columns: ["problem_id"]
isOneToOne: false
      referencedRelation: "problems"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposals_problem_id_fkey"
      columns: ["problem_id"]
isOneToOne: false
      referencedRelation: "problems_public"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_set_config":
{ Args: { "key": string,"reason": string,"value": Json }; Returns: undefined
                           },
"cast_vote":
{ Args: { "item_id": string,"item_type": string,"value": number }; Returns: undefined
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_vote":
{ Args: { "item_id": string,"item_type": string }; Returns: number
                           },
"my_writing_pause":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"rate_argument":
{ Args: { "argument_id": string,"useful": boolean }; Returns: undefined
                           },
"record_filter_block":
{ Args: { "content_type": string,"level": number }; Returns: string
                           },
"support_problem":
{ Args: { "problem_id": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
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
  "public": {
          Enums: {
            
          }
        }
} as const
