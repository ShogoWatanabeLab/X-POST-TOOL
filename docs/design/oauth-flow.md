# X OAuth 2.0 認証フロー設計

## 概要
X API v2のOAuth 2.0（Authorization Code Flow with PKCE）を自前実装。
Supabase Authとは独立して、X連携のみを管理する。

## 前提
- Supabaseでログイン済みのユーザーがX連携を行う
- トークンは暗号化してDBに保存
- リフレッシュトークンで自動更新（期限切れ時は再認可へ誘導）

---

## OAuth 2.0 フロー（Authorization Code Flow with PKCE）

### 1. 連携開始（/api/x/oauth/start）

**ユーザーアクション**: 「Xと連携する」ボタンをクリック

**処理フロー**:
1. セッション確認（Supabase Auth）
2. PKCE用の `code_verifier` と `code_challenge` を生成
3. `code_verifier` をセッションに保存（またはサーバー側キャッシュ）
4. X認可URLを生成してリダイレクト

**X認可URL**:
```
https://twitter.com/i/oauth2/authorize
  ?response_type=code
  &client_id={X_CLIENT_ID}
  &redirect_uri={X_REDIRECT_URI}
  &scope=tweet.read tweet.write users.read offline.access
  &state={random_state}
  &code_challenge={code_challenge}
  &code_challenge_method=S256
```

**スコープ**:
- `tweet.read`: 投稿の読み取り
- `tweet.write`: 投稿の作成
- `users.read`: ユーザー情報の取得
- `offline.access`: リフレッシュトークンの取得

**実装コード例**:
```typescript
// src/app/api/x/oauth/start/route.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import crypto from 'crypto';

export async function GET() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  // PKCE: code_verifier と code_challenge を生成
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  const state = crypto.randomBytes(16).toString('hex');

  // code_verifier をセッションに保存（有効期限10分）
  // TODO: Redis or Supabase Storageに保存
  // 仮実装: cookieに保存（本番では要改善）

  const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', process.env.X_CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', process.env.X_REDIRECT_URI!);
  authUrl.searchParams.set('scope', 'tweet.read tweet.write users.read offline.access');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  redirect(authUrl.toString());
}
```

---

### 2. コールバック（/api/x/oauth/callback）

**ユーザーアクション**: Xで認可完了後、リダイレクト

**処理フロー**:
1. URLパラメータから `code` と `state` を取得
2. `state` を検証（CSRF対策）
3. セッションから `code_verifier` を取得
4. X APIにトークンリクエスト（POST `/2/oauth2/token`）
5. 取得したトークンを暗号化してDBに保存
6. ユーザーをダッシュボードにリダイレクト

**トークンリクエスト**:
```
POST https://api.twitter.com/2/oauth2/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {base64(client_id:client_secret)}

grant_type=authorization_code
&code={code}
&redirect_uri={X_REDIRECT_URI}
&code_verifier={code_verifier}
```

**レスポンス**:
```json
{
  "token_type": "bearer",
  "expires_in": 7200,
  "access_token": "xxx",
  "refresh_token": "yyy",
  "scope": "tweet.read tweet.write users.read offline.access"
}
```

**実装コード例**:
```typescript
// src/app/api/x/oauth/callback/route.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { encryptToken } from '@/lib/crypto';

export async function GET(request: Request) {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return new Response('Bad Request', { status: 400 });
  }

  // TODO: state検証、code_verifier取得

  // X APIにトークンリクエスト
  const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.X_REDIRECT_URI!,
      code_verifier: codeVerifier, // TODO: セッションから取得
    }),
  });

  const tokens = await tokenResponse.json();

  // ユーザー情報取得（X API）
  const userResponse = await fetch('https://api.twitter.com/2/users/me', {
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
    },
  });
  const userData = await userResponse.json();

  // トークンを暗号化してDBに保存
  const accessTokenEncrypted = encryptToken(tokens.access_token);
  const refreshTokenEncrypted = encryptToken(tokens.refresh_token);

  await supabase.from('x_tokens').upsert({
    user_id: session.user.id,
    x_user_id: userData.data.id,
    x_username: userData.data.username,
    access_token_encrypted: accessTokenEncrypted,
    refresh_token_encrypted: refreshTokenEncrypted,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    scope: tokens.scope,
  });

  redirect('/dashboard');
}
```

---

### 3. トークン更新（リフレッシュ）

**トリガー**: アクセストークンの期限切れ時

**処理フロー**:
1. DBからリフレッシュトークンを取得・復号
2. X APIにリフレッシュリクエスト（POST `/2/oauth2/token`）
3. 新しいトークンを暗号化してDBに保存

**リフレッシュリクエスト**:
```
POST https://api.twitter.com/2/oauth2/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {base64(client_id:client_secret)}

grant_type=refresh_token
&refresh_token={refresh_token}
```

**実装コード例**:
```typescript
// src/lib/x-api/refresh-token.ts
import { createClient } from '@/lib/supabase/server';
import { encryptToken, decryptToken } from '@/lib/crypto';

export async function refreshXToken(userId: string) {
  const supabase = createClient();

  // DBからリフレッシュトークンを取得
  const { data: tokenData, error } = await supabase
    .from('x_tokens')
    .select('refresh_token_encrypted')
    .eq('user_id', userId)
    .single();

  if (error || !tokenData) {
    throw new Error('X token not found');
  }

  const refreshToken = decryptToken(tokenData.refresh_token_encrypted);

  // X APIにリフレッシュリクエスト
  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const tokens = await response.json();

  // 新しいトークンを暗号化してDBに保存
  await supabase.from('x_tokens').update({
    access_token_encrypted: encryptToken(tokens.access_token),
    refresh_token_encrypted: encryptToken(tokens.refresh_token),
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);

  return tokens.access_token;
}
```

---

### 4. 連携解除（Disconnect）

**ユーザーアクション**: 「連携を解除する」ボタンをクリック

**処理フロー**:
1. セッション確認
2. DBからトークンを削除
3. X APIのトークン無効化（オプション、失敗しても続行）

**実装コード例**:
```typescript
// src/app/api/x/disconnect/route.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  // DBからトークンを削除
  await supabase
    .from('x_tokens')
    .delete()
    .eq('user_id', session.user.id);

  // 監査ログに記録
  await supabase.from('audit_logs').insert({
    user_id: session.user.id,
    action: 'x_disconnected',
    resource_type: 'x_token',
  });

  return new Response('OK', { status: 200 });
}
```

---

## トークン暗号化・復号

### 暗号化方式
- **アルゴリズム**: AES-256-GCM
- **鍵**: 環境変数 `ENCRYPTION_KEY`（32バイト、base64エンコード）
- **IV**: ランダム生成（各暗号化ごとに異なる）

**実装コード例**:
```typescript
// src/lib/crypto.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'base64'); // 32バイト

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // iv + authTag + encrypted を結合して保存
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

---

## エラーハンドリング

### 想定されるエラー

| エラー | 原因 | 対応 |
|--------|------|------|
| `invalid_grant` | code_verifierが不正、codeが期限切れ | エラーメッセージ表示、再認可へ誘導 |
| `invalid_client` | client_id/client_secretが不正 | サーバー設定エラー、管理者に通知 |
| リフレッシュ失敗 | refresh_tokenが期限切れ、無効化済み | 再認可へ誘導、トークン削除 |
| ネットワークエラー | X APIへの接続失敗 | リトライ（最大3回）、失敗時はエラー表示 |

**エラー時の挙動**:
- ユーザーにはフレンドリーなメッセージ表示
- サーバーログに詳細なエラー内容を記録
- 監査ログに失敗を記録

---

## セキュリティ要件

- ✅ **PKCE**: code_verifierとcode_challengeで認可コードの漏洩を防ぐ
- ✅ **State検証**: CSRFを防ぐ
- ✅ **トークン暗号化**: DBに平文保存しない
- ✅ **HTTPS必須**: リダイレクトURIはHTTPSのみ
- ✅ **スコープ最小化**: 必要なスコープのみ要求

---

## テスト観点

- [ ] 正常フロー: 連携開始→認可→コールバック→トークン保存
- [ ] トークン更新: 期限切れ時に自動リフレッシュ
- [ ] 連携解除: トークン削除、監査ログ記録
- [ ] エラーケース: 不正なcode、期限切れrefresh_token
- [ ] セキュリティ: 暗号化・復号が正しく動作、他ユーザーのトークンにアクセス不可

---

## 実装時の注意点

1. **code_verifierの保存**: セッションまたはRedisに保存（cookieは非推奨）
2. **state検証**: CSRF対策として必須
3. **エラーログ**: X APIのエラーレスポンスをそのまま記録（デバッグ用）
4. **リトライ戦略**: ネットワークエラー時のみリトライ、認証エラーは即座に失敗
5. **トークン期限管理**: `expires_at` を確認してから使用、期限切れ時は自動リフレッシュ

---

## 参考
- [X API OAuth 2.0 Documentation](https://developer.x.com/en/docs/authentication/oauth-2-0)
- [PKCE (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636)
