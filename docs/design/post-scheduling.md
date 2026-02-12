# 予約投稿・Cron実行設計

## 概要
Vercel Cron Jobsを使用して、予約投稿を10分間隔で処理する。
同時刻の複数予約、二重実行防止、失敗時の処理を含む。

## 運用方針
- 予約UI: 10分刻み（JST固定）
- Cron実行: 10分間隔
- 同時刻複数予約OK（投稿時に1分ずつずらす）
- Cron1回の処理上限: 最大5件
- 自動リトライなし（手動再実行のみ）

---

## 投稿ステータス遷移

```
draft → pending → posted
                → failed
                → cancelled
```

### ステータス定義

| ステータス | 説明 |
|-----------|------|
| `draft` | 下書き（予約未設定） |
| `pending` | 予約済み（Cron待機中） |
| `posted` | 投稿成功 |
| `failed` | 投稿失敗 |
| `cancelled` | ユーザーがキャンセル |

### 状態遷移ルール

- `draft → pending`: ユーザーが予約設定
- `pending → posted`: Cronで投稿成功
- `pending → failed`: Cronで投稿失敗
- `pending → cancelled`: ユーザーがキャンセル
- `failed → pending`: ユーザーが手動で再予約
- `posted`, `cancelled` は変更不可（最終状態）

---

## Cron処理フロー（/api/cron/process-scheduled-posts）

### 1. 実行トリガー
- Vercel Cron Jobs（10分間隔）
- `vercel.json` で設定:
```json
{
  "crons": [
    {
      "path": "/api/cron/process-scheduled-posts",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

### 2. 認証
- `Authorization: Bearer {CRON_SECRET}` ヘッダで検証
- 不正なリクエストは`401 Unauthorized`

### 3. 処理ステップ

#### Step 1: 対象投稿を取得
```sql
SELECT * FROM posts
WHERE status = 'pending'
  AND scheduled_at <= NOW()
ORDER BY scheduled_at ASC, created_at ASC
LIMIT 5;
```

**制約**:
- 最大5件まで処理（Cron実行時間制限を考慮）
- `scheduled_at` が現在時刻以前
- `status = 'pending'` のみ

#### Step 2: 同時刻投稿のずらし処理
同じ `scheduled_at` を持つ投稿が複数ある場合、1分ずつずらす。

**ロジック**:
```typescript
const posts = await fetchPendingPosts();
const postsByTime = groupBy(posts, 'scheduled_at');

for (const [scheduledTime, postsAtSameTime] of Object.entries(postsByTime)) {
  for (let i = 0; i < postsAtSameTime.length; i++) {
    const actualPostTime = new Date(scheduledTime);
    actualPostTime.setMinutes(actualPostTime.getMinutes() + i);
    postsAtSameTime[i].actualPostTime = actualPostTime;
  }
}
```

#### Step 3: 投稿実行
各投稿を順次実行（並列実行しない）

```typescript
for (const post of posts) {
  try {
    // X API に投稿
    const xPostId = await postToX(post.user_id, post.content, post.actualPostTime);

    // 成功: status更新
    await updatePostStatus(post.id, 'posted', xPostId);

    // 監査ログ記録
    await logAudit(post.user_id, 'post_posted', post.id);

  } catch (error) {
    // 失敗: status更新、エラーメッセージ保存
    await updatePostStatus(post.id, 'failed', null, error.message);

    // 監査ログ記録
    await logAudit(post.user_id, 'post_failed', post.id, { error: error.message });
  }
}
```

#### Step 4: レスポンス返却
```json
{
  "data": {
    "processed": 5,
    "succeeded": 4,
    "failed": 1
  }
}
```

---

## 二重実行防止

### 問題
Cronが10分間隔で実行されるが、前回の処理が終わらないうちに次回が開始される可能性がある。

### 対策1: ステータスで制御
- `status = 'pending'` のみを対象にする
- 処理完了後に `'posted'` または `'failed'` に変更
- 同じ投稿が2回処理されることを防ぐ

### 対策2: 実行ロック（オプション）
分散ロックを使用して、同時実行を防ぐ。

**実装例（Redisロック）**:
```typescript
const lock = await redis.set('cron:process-scheduled-posts', '1', 'EX', 600, 'NX');

if (!lock) {
  return { message: 'Already running' };
}

try {
  // Cron処理
} finally {
  await redis.del('cron:process-scheduled-posts');
}
```

**実装例（DBロック）**:
```sql
-- ロックテーブルを作成
CREATE TABLE cron_locks (
  lock_name TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- ロック取得
INSERT INTO cron_locks (lock_name, locked_at, expires_at)
VALUES ('process-scheduled-posts', NOW(), NOW() + INTERVAL '10 minutes')
ON CONFLICT (lock_name) DO NOTHING
RETURNING *;

-- ロックが取得できれば処理実行
-- 処理完了後、ロック削除
DELETE FROM cron_locks WHERE lock_name = 'process-scheduled-posts';
```

**注意**: MVP段階ではステータス制御のみで十分。ロックはスケール時に追加。

---

## 投稿タイミングの丸め処理

### UIでの入力
- ユーザーは10分刻みで時刻を選択（例: 12:00, 12:10, 12:20）
- JST（日本時間）固定

### DB保存
- UTCで保存（Postgresの`TIMESTAMPTZ`）
- JST → UTC変換時に丸め処理

**丸め関数**:
```typescript
export function roundToNext10Minutes(date: Date): Date {
  const minutes = date.getMinutes();
  const remainder = minutes % 10;
  const roundedMinutes = remainder === 0 ? minutes : minutes + (10 - remainder);

  const rounded = new Date(date);
  rounded.setMinutes(roundedMinutes);
  rounded.setSeconds(0);
  rounded.setMilliseconds(0);

  return rounded;
}
```

**テストケース**:
```typescript
// 12:03 → 12:10
// 12:10 → 12:10
// 12:17 → 12:20
// 12:59 → 13:00
```

---

## エラーハンドリング

### 想定されるエラー

| エラー | 原因 | 対応 |
|--------|------|------|
| X API認証エラー | トークン期限切れ、無効化 | `failed`、ユーザーに再認可を促す |
| X API投稿エラー | 重複投稿、文字数超過 | `failed`、エラーメッセージ保存 |
| ネットワークエラー | タイムアウト、接続失敗 | `failed`、手動再実行を促す |
| DB更新エラー | 接続失敗、制約違反 | ログ記録、次回Cronでリトライ |

### エラー時の挙動
1. `status = 'failed'` に更新
2. `error_message` にエラー内容を保存
3. 監査ログに記録
4. **自動リトライなし**（ユーザーが手動で再予約）

---

## 手動再実行

### フロー
1. ユーザーが失敗した投稿を確認
2. 「再予約」ボタンをクリック
3. 新しい `scheduled_at` を設定
4. `status = 'failed' → 'pending'` に変更
5. 次回Cronで再処理

### API
```typescript
// PUT /api/posts/[id]/reschedule
{
  "scheduled_at": "2024-01-01T13:00:00Z"
}
```

**バリデーション**:
- `status = 'failed'` のみ再予約可能
- `scheduled_at` は現在時刻より未来

---

## スレッド投稿の処理

### 親子関係
- `parent_post_id` で親投稿を参照
- `thread_order` で順序を管理（0始まり）

### 投稿順序
1. 親投稿（`thread_order = 0`）を投稿
2. X APIから `x_post_id` を取得
3. 子投稿（`thread_order = 1`）を投稿時に `reply_to` パラメータで親を指定
4. 順次投稿（同時投稿しない）

### エラー時の挙動
- 親投稿が失敗 → 子投稿はすべて `failed` に変更
- 子投稿が失敗 → 以降の子投稿は `failed` に変更、親と成功した子はそのまま

---

## メトリクス取得Cron（/api/cron/fetch-metrics）

### 実行頻度
- 1日1回（例: 毎日AM3:00 JST）

### 処理フロー
1. 全ユーザーの最近投稿された投稿を取得（`posted_at` が直近7日以内）
2. 各投稿のX APIメトリクスを取得
3. `post_metrics` テーブルに保存（既存データは上書き）

### X APIリクエスト
```
GET https://api.twitter.com/2/tweets/:id
  ?tweet.fields=public_metrics,non_public_metrics,organic_metrics
```

**レスポンス**:
```json
{
  "data": {
    "id": "123456789",
    "public_metrics": {
      "like_count": 10,
      "retweet_count": 2,
      "reply_count": 1,
      "impression_count": 100
    },
    "non_public_metrics": {
      "url_link_clicks": 5,
      "user_profile_clicks": 3
    },
    "organic_metrics": {
      "like_count": 8,
      "retweet_count": 1
    }
  }
}
```

### エラーハンドリング
- 一部のメトリクスが取得できない場合、`NULL` で保存
- ユーザーごとに処理を独立（1ユーザーの失敗が全体に影響しない）
- X APIレート制限を考慮（1ユーザーあたり最大10投稿/回など）

---

## セキュリティ要件

- ✅ Cronエンドポイントは `CRON_SECRET` で保護
- ✅ 二重実行防止（ステータス制御 or ロック）
- ✅ トークン期限確認、期限切れ時は再認可へ誘導
- ✅ 監査ログに全投稿・失敗を記録

---

## テスト観点

- [ ] 正常フロー: pending → posted
- [ ] 同時刻複数予約: 1分ずつずらされるか
- [ ] 失敗時: pending → failed、エラーメッセージ保存
- [ ] 二重実行防止: 同じ投稿が2回投稿されないか
- [ ] スレッド投稿: 親→子の順序で投稿されるか
- [ ] Cron認証: 不正なリクエストは401

---

## 実装時の注意点

1. **タイムゾーン**: DBはUTC、UIはJST、変換ミスに注意
2. **Vercel Cron制限**: 最大実行時間10秒（Hobby plan）、処理は軽量に
3. **ログ**: 投稿成功・失敗をすべて記録（デバッグ用）
4. **冪等性**: 同じ投稿を2回処理してもDB状態が壊れないように
5. **スケール**: 将来的にユーザーが増えた場合、バッチ処理やキュー導入を検討

---

## 参考
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [X API POST /2/tweets](https://developer.x.com/en/docs/twitter-api/tweets/manage-tweets/api-reference/post-tweets)
