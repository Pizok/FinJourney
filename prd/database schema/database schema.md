## Table `journey_profiles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `username` | `text` |  Unique |
| `timezone` | `text` |  Nullable |
| `last_timezone_change_at` | `timestamptz` |  Nullable |
| `active_path` | `player_path` |  Nullable |
| `path_cooldown_until` | `timestamptz` |  Nullable |
| `has_completed_setup` | `bool` |  Nullable |
| `feature_unlocks` | `jsonb` |  Nullable |
| `expected_monthly_income` | `numeric` |  Nullable |
| `monthly_savings_target` | `numeric` |  Nullable |
| `primary_payday` | `int4` |  Nullable |
| `app_preferences` | `jsonb` |  Nullable |
| `notification_settings` | `jsonb` |  Nullable |
| `current_hp` | `numeric` |  Nullable |
| `total_xp` | `numeric` |  Nullable |
| `current_level` | `int4` |  Nullable |
| `vitality` | `vitality_state` |  Nullable |
| `current_streak` | `int4` |  Nullable |
| `longest_streak` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `wallets`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `name` | `text` |  |
| `type` | `text` |  |
| `balance` | `numeric` |  Nullable |
| `last_reconciled_at` | `timestamptz` |  Nullable |
| `color_token` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `deleted_at` | `timestamptz` |  Nullable |

## Table `categories`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `name` | `text` |  |
| `category_group` | `category_group` |  |
| `monthly_limit` | `numeric` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `deleted_at` | `timestamptz` |  Nullable |

## Table `transactions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `primary_wallet_id` | `uuid` |  Nullable |
| `source_wallet_id` | `uuid` |  Nullable |
| `destination_wallet_id` | `uuid` |  Nullable |
| `transfer_group_id` | `uuid` |  Nullable |
| `category_id` | `uuid` |  Nullable |
| `type` | `transaction_type` |  |
| `amount` | `numeric` |  |
| `payment_method` | `text` |  |
| `status` | `text` |  Nullable |
| `note` | `text` |  Nullable |
| `transaction_date` | `date` |  |
| `logged_at` | `timestamptz` |  Nullable |
| `deleted_at` | `timestamptz` |  Nullable |

## Table `fixed_expenses`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `name` | `text` |  |
| `amount` | `numeric` |  |
| `recurrence_type` | `recurrence_type` |  |
| `recurrence_value` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `loans`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `name` | `text` |  |
| `status` | `loan_status` |  Nullable |
| `total_amount` | `numeric` |  |
| `paid_amount` | `numeric` |  Nullable |
| `next_due_date` | `date` |  Nullable |
| `monthly_installment` | `numeric` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `savings_targets`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `name` | `text` |  |
| `target_amount` | `numeric` |  |
| `current_amount` | `numeric` |  Nullable |
| `priority` | `int4` |  Nullable |
| `deadline` | `date` |  |
| `status` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `deleted_at` | `timestamptz` |  Nullable |

## Table `journey_daily_survival`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `tracking_date` | `date` | Primary |
| `status` | `daily_survival_status` |  Nullable |
| `expense_xp_claimed` | `bool` |  Nullable |
| `income_xp_claimed` | `bool` |  Nullable |
| `zero_spend_xp_claimed` | `bool` |  Nullable |
| `last_evaluated_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `journey_inventory`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `type` | `item_type` |  |
| `status` | `item_status` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `activated_at` | `timestamptz` |  Nullable |
| `expires_at` | `timestamptz` |  Nullable |
| `source_event_id` | `uuid` |  Nullable |

## Table `journey_events`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `idempotency_key` | `text` |  Unique |
| `user_id` | `uuid` |  Nullable |
| `event_type` | `text` |  |
| `event_version` | `int4` |  Nullable |
| `source` | `event_source` |  |
| `severity` | `event_severity` |  |
| `status` | `event_status` |  Nullable |
| `xp_delta` | `int4` |  Nullable |
| `hp_delta` | `int4` |  Nullable |
| `shield_delta` | `int4` |  Nullable |
| `payload` | `jsonb` |  Nullable |
| `error_log` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `processed_at` | `timestamptz` |  Nullable |
| `published_at` | `timestamptz` |  Nullable |
| `retry_count` | `int4` |  Nullable |

## Table `journey_challenges`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `template_id` | `text` |  |
| `status` | `challenge_status` |  Nullable |
| `started_at` | `timestamptz` |  |
| `ends_at` | `timestamptz` |  |
| `completed_at` | `timestamptz` |  Nullable |
| `progress_data` | `jsonb` |  Nullable |
| `rewards_claimed` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `journey_regions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `region_id` | `text` |  |
| `status` | `region_status` |  Nullable |
| `started_at` | `timestamptz` |  |
| `ends_at` | `timestamptz` |  |
| `shifted_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `journey_notifications`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `source_event_id` | `uuid` |  Nullable |
| `category` | `notification_category` |  |
| `severity` | `event_severity` |  |
| `status` | `notification_status` |  Nullable |
| `title` | `text` |  |
| `message` | `text` |  |
| `action_type` | `text` |  Nullable |
| `action_payload` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `read_at` | `timestamptz` |  Nullable |
| `archived_at` | `timestamptz` |  Nullable |

