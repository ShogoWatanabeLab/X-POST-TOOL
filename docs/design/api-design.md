# API設計

## 概要
Next.js App RouterのAPI Routes（`/app/api/`）で実装するREST API設計。
全エンドポイントはSupabase Authのセッション認証を必須とする。

## 共通仕様

### 認証
- **方式**: Supabase Auth（セッションCookie）
- **実装**: `createServerComponentClient({ cookies })`でセッション確認
- **未認証時**: `401 Unauthorized`

### レスポンス形式
```typescript
// 成功時
{
  "data": any,
  "message"?: string
}

// エラー時
{
  "error": string,
  "details"?: any
}
```

### HTTPステータスコード
- `200 OK`: 成功
- `201 Created`: リソース作成成功
- `400 Bad Request`: リクエストが不正
- `401 Unauthorized`: 未認証
- `403 Forbidden`: 権限なし
- `404 Not Found`: リソースが存在しない
- `409 Conflict`: リソース競合
- `500 Internal Server Error`: サーバーエラー

---

## エンドポイント一覧

### 1. 認証関連

#### GET /api/auth/session
現在のセッション情報を取得

**レスポンス**:
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    },
    "session": { ... }
  }
}
```

---

### 2. プロフィール関連

#### GET /api/profile
ユーザープロフィールを取得

**レスポンス**:
```json
{
  "data": {
    "id": "uuid",
    "display_name": "John Doe",
    "bio": "Developer",
    "avatar_url": "https://...",
    "interest_categories": ["tech", "startup"],
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

#### PUT /api/profile
プロフィールを更新

**リクエスト**:
```json
{
  "display_name": "John Doe",
  "bio": "Developer",
  "interest_categories": ["tech", "startup"]
}
```

**バリデーション**:
- `interest_categories`: 最大3つ
- `display_name`: 1-50文字
- `bio`: 0-200文字

**レスポンス**:
```json
{
  "data": { ... },
  "message": "Profile updated successfully"
}
```

---

### 3. X連携関連

#### GET /api/x/oauth/start
X OAuth認証を開始（リダイレクト）

#### GET /api/x/oauth/callback
X OAuth認証コールバック（リダイレクト）

#### GET /api/x/status
X連携状態を取得

**レスポンス**:
```json
{
  "data": {
    "connected": true,
    "x_username": "johndoe",
    "x_user_id": "12345",
    "expires_at": "2024-01-01T00:00:00Z"
  }
}
```

#### POST /api/x/disconnect
X連携を解除

**レスポンス**:
```json
{
  "message": "Disconnected successfully"
}
```

---

### 4. 投稿生成関連

#### POST /api/posts/generate
LLMで投稿案を生成

**リクエスト**:
```json
{
  "input_text": "今日学んだこと\n- TypeScript\n- Next.js",
  "count": 5
}
```

**バリデーション**:
- `input_text`: 1-1000文字
- `count`: 1-10（デフォルト5）
- 日次上限チェック（`generation_history`テーブル）

**レスポンス**:
```json
{
  "data": {
    "posts": [
      {
        "content": "今日はTypeScriptとNext.jsを学びました！",
        "post_type": "dev_log"
      },
      ...
    ],
    "remaining_quota": 15
  }
}
```

**エラー**:
- `429 Too Many Requests`: 日次上限超過

---

### 5. 投稿関連

#### POST /api/posts
投稿を作成（即時 or 予約）

**リクエスト**:
```json
{
  "content": "投稿内容",
  "post_type": "dev_log",
  "scheduled_at": "2024-01-01T12:00:00Z", // null の場合は即時投稿
  "is_thread": false,
  "parent_post_id": null
}
```

**バリデーション**:
- `content`: 1-280文字（X制限）
- `scheduled_at`: 現在時刻より未来、10分刻み（JST）
- `post_type`: 'dev_log' | 'tips' | 'failure_story' | 'comparison'

**レスポンス**:
```json
{
  "data": {
    "id": "uuid",
    "status": "posted" // or "pending" (予約の場合)
  },
  "message": "Posted successfully" // or "Scheduled successfully"
}
```

#### GET /api/posts
投稿一覧を取得

**クエリパラメータ**:
- `status`: 'draft' | 'pending' | 'posted' | 'failed' | 'cancelled'
- `limit`: 1-100（デフォルト20）
- `offset`: 0以上（デフォルト0）
- `from_date`: ISO8601形式
- `to_date`: ISO8601形式

**レスポンス**:
```json
{
  "data": {
    "posts": [ ... ],
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}
```

#### GET /api/posts/[id]
投稿詳細を取得

**レスポンス**:
```json
{
  "data": {
    "id": "uuid",
    "content": "投稿内容",
    "post_type": "dev_log",
    "status": "posted",
    "scheduled_at": null,
    "posted_at": "2024-01-01T12:00:00Z",
    "x_post_id": "123456789",
    "metrics": {
      "likes": 10,
      "retweets": 2,
      "replies": 1,
      "impressions": 100
    }
  }
}
```

#### PUT /api/posts/[id]
投稿を更新（draft/pendingのみ）

**リクエスト**:
```json
{
  "content": "更新後の内容",
  "scheduled_at": "2024-01-01T13:00:00Z"
}
```

**バリデーション**:
- status が 'draft' または 'pending' のみ更新可能
- posted/failed/cancelled は更新不可

**レスポンス**:
```json
{
  "data": { ... },
  "message": "Post updated successfully"
}
```

#### DELETE /api/posts/[id]
投稿を削除（draft/pending/failedのみ）

**バリデーション**:
- status が 'posted' の場合は削除不可

**レスポンス**:
```json
{
  "message": "Post deleted successfully"
}
```

#### POST /api/posts/[id]/cancel
予約投稿をキャンセル

**バリデーション**:
- status が 'pending' のみ

**レスポンス**:
```json
{
  "data": {
    "id": "uuid",
    "status": "cancelled"
  },
  "message": "Post cancelled successfully"
}
```

#### PUT /api/posts/[id]/reschedule
失敗した投稿を再予約

**リクエスト**:
```json
{
  "scheduled_at": "2024-01-01T13:00:00Z"
}
```

**バリデーション**:
- status が 'failed' のみ再予約可能
- `scheduled_at` は現在時刻より未来、10分刻み（JST）

**レスポンス**:
```json
{
  "data": {
    "id": "uuid",
    "status": "pending"
  },
  "message": "Post rescheduled successfully"
}
```

---

### 6. 画像付き投稿

#### POST /api/posts/upload-media
画像をXにアップロード（media_idを取得）

**リクエスト**:
- `Content-Type: multipart/form-data`
- `file`: 画像ファイル（最大5MB、JPEG/PNG/GIF）

**レスポンス**:
```json
{
  "data": {
    "media_id": "123456789"
  }
}
```

#### POST /api/posts/with-media
画像付き投稿を作成

**リクエスト**:
```json
{
  "content": "投稿内容",
  "post_type": "dev_log",
  "media_id": "123456789",
  "scheduled_at": null
}
```

---

### 7. メトリクス関連

#### GET /api/metrics/posts/[id]
特定投稿のメトリクスを取得

**レスポンス**:
```json
{
  "data": {
    "post_id": "uuid",
    "likes": 10,
    "retweets": 2,
    "replies": 1,
    "impressions": 100,
    "fetched_at": "2024-01-01T00:00:00Z"
  }
}
```

#### GET /api/metrics/summary
メトリクス集計を取得

**クエリパラメータ**:
- `from_date`: ISO8601形式
- `to_date`: ISO8601形式
- `group_by`: 'post_type' | 'hour'

**レスポンス**:
```json
{
  "data": {
    "total_posts": 100,
    "total_likes": 500,
    "total_retweets": 50,
    "total_replies": 30,
    "avg_engagement": 5.8,
    "by_post_type": [
      {
        "post_type": "dev_log",
        "count": 50,
        "avg_likes": 10,
        "median_likes": 8
      },
      ...
    ]
  }
}
```

---

### 8. Cron（内部API）

#### POST /api/cron/process-scheduled-posts
予約投稿を処理（10分間隔で実行）

**認証**:
- Vercel Cronからのリクエストのみ
- `Authorization: Bearer {CRON_SECRET}`

**処理**:
1. `scheduled_at <= NOW()` かつ `status = 'pending'` の投稿を取得（最大5件）
2. 同時刻の投稿は1分ずつずらす
3. X APIに投稿
4. status更新（'posted' or 'failed'）

**レスポンス**:
```json
{
  "data": {
    "processed": 3,
    "succeeded": 2,
    "failed": 1
  }
}
```

#### POST /api/cron/fetch-metrics
メトリクスを取得（1日1回実行）

**認証**:
- Vercel Cronからのリクエストのみ
- `Authorization: Bearer {CRON_SECRET}`

**処理**:
1. 全ユーザーの最近投稿されたpostを取得
2. X APIでメトリクス取得
3. `post_metrics` テーブルに保存

**レスポンス**:
```json
{
  "data": {
    "users_processed": 10,
    "posts_updated": 50
  }
}
```

---

### 9. Stripe決済

#### POST /api/stripe/create-checkout-session
Checkout Sessionを作成

**リクエスト**:
```json
{
  "plan": "basic" // or "pro"
}
```

**レスポンス**:
```json
{
  "data": {
    "session_id": "cs_xxx",
    "url": "https://checkout.stripe.com/..."
  }
}
```

#### POST /api/stripe/webhook
Stripe Webhookを受信

**認証**:
- Stripe署名検証（`stripe-signature`ヘッダ）

**処理**:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

**冪等性**:
- `stripe_events` テーブルで `stripe_event_id` をチェック

**レスポンス**:
```json
{
  "received": true
}
```

#### GET /api/stripe/portal-session
Customer Portal Sessionを作成

**レスポンス**:
```json
{
  "data": {
    "url": "https://billing.stripe.com/..."
  }
}
```

---

## エラーハンドリング

### 共通エラーレスポンス例

```json
{
  "error": "Invalid request",
  "details": {
    "field": "content",
    "message": "Content must be between 1 and 280 characters"
  }
}
```

### ログ記録
- 全エラーはサーバーログに記録
- 重要なアクション（投稿、課金）は `audit_logs` に記録

---

## セキュリティ要件

- ✅ 全エンドポイントでセッション確認
- ✅ RLSで他ユーザーのデータにアクセス不可
- ✅ 入力値バリデーション（XSS, SQL Injection対策）
- ✅ レートリミット（生成API、投稿API）
- ✅ Cronエンドポイントは秘密鍵で保護

---

## テスト観点

- [ ] 認証エラー（未ログイン時に401）
- [ ] バリデーションエラー（不正な入力で400）
- [ ] RLS（他ユーザーのデータにアクセスできないか）
- [ ] 冪等性（Stripe Webhook、Cron）
- [ ] レートリミット（生成API）

---

## 実装時の注意点

1. **エラーハンドリング**: try-catchで適切にキャッチ、ユーザーフレンドリーなメッセージ
2. **ログ**: 本番で確認できる形式で出力
3. **トランザクション**: 複数テーブル更新時はトランザクション使用
4. **キャッシュ**: メトリクス取得はDBキャッシュを優先（X API叩きすぎない）

---

## 参考
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
