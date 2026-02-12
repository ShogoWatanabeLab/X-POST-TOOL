# データベーススキーマ設計

## 概要
X投稿支援ツールのデータベーススキーマ定義。
Supabase（PostgreSQL）を使用し、マルチユーザー対応・RLS（Row Level Security）を前提とする。

## 設計方針
- Supabase Authの `auth.users` を利用（独自usersテーブルは作らない）
- 全テーブルに `user_id` を含め、RLSで他ユーザーのデータを隔離
- タイムスタンプ（`created_at`, `updated_at`）を全テーブルに含める
- 外部キーは `ON DELETE CASCADE` または `ON DELETE SET NULL` を適切に設定
- インデックスは頻繁にクエリされるカラムに設定

---

## テーブル一覧

### 1. profiles
ユーザープロフィール（Supabase Authと1:1）

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  interest_categories TEXT[] DEFAULT '{}', -- 興味カテゴリ（最大3つ）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

---

### 2. x_tokens
Xアカウント連携トークン（暗号化して保存）

```sql
CREATE TABLE x_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  x_user_id TEXT NOT NULL, -- X側のユーザーID
  x_username TEXT NOT NULL, -- X側のユーザー名（表示用）
  access_token_encrypted TEXT NOT NULL, -- 暗号化されたアクセストークン
  refresh_token_encrypted TEXT, -- 暗号化されたリフレッシュトークン
  expires_at TIMESTAMPTZ, -- アクセストークンの有効期限
  scope TEXT, -- 許可されたスコープ
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id) -- 1ユーザー1X連携
);

-- RLS
ALTER TABLE x_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tokens"
  ON x_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens"
  ON x_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
  ON x_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
  ON x_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- インデックス
CREATE INDEX idx_x_tokens_user_id ON x_tokens(user_id);
CREATE INDEX idx_x_tokens_expires_at ON x_tokens(expires_at);
```

---

### 3. posts
投稿（生成された投稿案・実際に投稿されたもの）

```sql
CREATE TYPE post_status AS ENUM ('draft', 'pending', 'posted', 'failed', 'cancelled');
CREATE TYPE post_type AS ENUM ('dev_log', 'tips', 'failure_story', 'comparison');

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  post_type post_type NOT NULL,
  status post_status NOT NULL DEFAULT 'draft',

  -- 予約投稿関連
  scheduled_at TIMESTAMPTZ, -- 予約投稿日時（NULLの場合は即時投稿）
  posted_at TIMESTAMPTZ, -- 実際に投稿された日時

  -- X API関連
  x_post_id TEXT, -- X側の投稿ID（投稿成功時に保存）
  parent_post_id UUID REFERENCES posts(id) ON DELETE SET NULL, -- スレッドの親投稿

  -- エラー情報
  error_message TEXT, -- 投稿失敗時のエラーメッセージ

  -- メタデータ
  is_thread BOOLEAN DEFAULT FALSE, -- スレッド投稿かどうか
  thread_order INTEGER, -- スレッド内の順序（0始まり）

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own posts"
  ON posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  USING (auth.uid() = user_id);

-- インデックス
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_scheduled_at ON posts(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_posts_posted_at ON posts(posted_at) WHERE posted_at IS NOT NULL;
CREATE INDEX idx_posts_x_post_id ON posts(x_post_id) WHERE x_post_id IS NOT NULL;
CREATE INDEX idx_posts_parent_post_id ON posts(parent_post_id) WHERE parent_post_id IS NOT NULL;
```

---

### 4. post_metrics
投稿のメトリクス（X APIから取得）

```sql
CREATE TABLE post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- public_metrics（必ず取得）
  likes INTEGER NOT NULL DEFAULT 0,
  retweets INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER, -- 取得できない場合がある

  -- non_public_metrics（取得できない場合がある）
  url_link_clicks INTEGER,
  user_profile_clicks INTEGER,

  -- organic_metrics（取得できない場合がある）
  organic_impressions INTEGER,
  organic_likes INTEGER,
  organic_retweets INTEGER,
  organic_replies INTEGER,

  -- 取得日時
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(post_id, fetched_at) -- 同じ投稿の同じ日時のメトリクスは1つ
);

-- RLS
ALTER TABLE post_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metrics"
  ON post_metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own metrics"
  ON post_metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- インデックス
CREATE INDEX idx_post_metrics_post_id ON post_metrics(post_id);
CREATE INDEX idx_post_metrics_user_id ON post_metrics(user_id);
CREATE INDEX idx_post_metrics_fetched_at ON post_metrics(fetched_at);
```

---

### 5. generation_history
LLM投稿案生成履歴（日次上限管理用）

```sql
CREATE TABLE generation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_text TEXT NOT NULL, -- 入力した箇条書き
  generated_count INTEGER NOT NULL DEFAULT 5, -- 生成した案の数
  tokens_used INTEGER, -- 使用したトークン数（LLMプロバイダによる）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE generation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generation history"
  ON generation_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generation history"
  ON generation_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- インデックス
CREATE INDEX idx_generation_history_user_id ON generation_history(user_id);
CREATE INDEX idx_generation_history_created_at ON generation_history(created_at);
```

---

### 6. audit_logs
監査ログ（投稿・予約・取消・再実行の記録）

```sql
CREATE TYPE audit_action AS ENUM (
  'post_created',
  'post_scheduled',
  'post_posted',
  'post_failed',
  'post_cancelled',
  'post_rescheduled',
  'x_connected',
  'x_disconnected'
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action audit_action NOT NULL,
  resource_type TEXT NOT NULL, -- 'post', 'x_token' など
  resource_id UUID, -- 対象のリソースID
  metadata JSONB, -- 追加情報（エラー内容など）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- インデックス
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```

---

### 7. subscriptions
Stripe決済・サブスクリプション管理

```sql
CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'cancelled', 'past_due');
CREATE TYPE subscription_plan AS ENUM ('free', 'basic', 'pro'); -- 後で調整可能

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL, -- Stripe Customer ID
  stripe_subscription_id TEXT, -- Stripe Subscription ID
  plan subscription_plan NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'inactive',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id) -- 1ユーザー1サブスクリプション
);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- インデックス
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
```

---

### 8. stripe_events
Stripe Webhook イベント管理（冪等性確保）

```sql
CREATE TABLE stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE, -- Stripe Event ID（重複チェック用）
  event_type TEXT NOT NULL, -- 'customer.subscription.updated' など
  processed BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- インデックス
CREATE INDEX idx_stripe_events_stripe_event_id ON stripe_events(stripe_event_id);
CREATE INDEX idx_stripe_events_processed ON stripe_events(processed);
```

---

## トリガー（updated_at自動更新）

全テーブルの `updated_at` を自動更新するトリガーを設定。

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 各テーブルにトリガーを設定
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_x_tokens_updated_at BEFORE UPDATE ON x_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_metrics_updated_at BEFORE UPDATE ON post_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## マイグレーション戦略

1. **初回マイグレーション**: 全テーブル作成
2. **以降の変更**: 追加のみ（カラム追加・インデックス追加）
3. **削除が必要な場合**: 新カラム追加 → データ移行 → 旧カラム削除の3段階

---

## セキュリティ要件

### RLS（Row Level Security）
- ✅ 全テーブルでRLS有効化
- ✅ ユーザーは自分のデータのみアクセス可能
- ✅ `auth.uid()` で現在のユーザーを特定

### トークン暗号化
- ✅ `x_tokens` テーブルの `access_token_encrypted`, `refresh_token_encrypted` は暗号化して保存
- ✅ 復号はサーバーサイドのみ（環境変数 `ENCRYPTION_KEY` 使用）

### Stripe Webhook冪等性
- ✅ `stripe_events` テーブルで `stripe_event_id` の重複チェック
- ✅ 同じイベントの二重処理を防ぐ

---

## テスト観点

- [ ] RLSが正しく機能するか（他ユーザーのデータが見えないか）
- [ ] 外部キー制約が正しく設定されているか
- [ ] トリガーで `updated_at` が自動更新されるか
- [ ] Unique制約が機能するか（`x_tokens.user_id`, `subscriptions.user_id`）
- [ ] インデックスが適切に設定されているか（クエリパフォーマンス）

---

## 実装時の注意点

1. **Supabase migrations**: `supabase/migrations/` でバージョン管理
2. **型定義**: TypeScript型を自動生成（`supabase gen types typescript`）
3. **初期データ**: カテゴリマスタなど固定データは seed で投入
4. **バックアップ**: 本番環境は自動バックアップ有効化

---

## 参考
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Triggers](https://www.postgresql.org/docs/current/sql-createtrigger.html)
