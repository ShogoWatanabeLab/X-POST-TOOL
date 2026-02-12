# X投稿支援ツール - 開発ルール

## プロジェクト概要
X（旧Twitter）の投稿作成・予約・分析を支援するWebアプリケーション。
AI駆動開発の過程を30日間note連載するための実装プロジェクト。

## 技術スタック
- **言語**: TypeScript
- **フレームワーク**: Next.js 14 (App Router)
- **スタイリング**: Tailwind CSS
- **認証/DB**: Supabase (Postgres + Supabase Auth)
- **本番環境**: Vercel
- **ローカル開発**: Docker (web + Supabase local)
- **決済**: Stripe
- **外部API**: X API v2

## ディレクトリ構造
```
x-post-tool/
├── .claude/              # Claude Code設定
├── docs/                 # ドキュメント
│   ├── design/          # 設計ファイル（Claude作成）
│   └── instructions/    # AI別の指示ファイル
├── docker/              # Docker設定
│   ├── Dockerfile
│   └── docker-compose.yml
├── supabase/            # Supabase設定
│   ├── migrations/      # DBマイグレーション
│   └── config.toml
├── src/
│   ├── app/            # Next.js App Router
│   │   ├── (auth)/    # 認証関連ページ
│   │   ├── (protected)/ # ログイン必須ページ
│   │   ├── api/       # API Routes
│   │   └── layout.tsx
│   ├── components/     # Reactコンポーネント
│   │   ├── ui/        # 共通UIコンポーネント
│   │   └── features/  # 機能別コンポーネント
│   ├── lib/           # ユーティリティ
│   │   ├── supabase/  # Supabaseクライアント
│   │   ├── x-api/     # X API クライアント
│   │   └── utils/     # 汎用ユーティリティ
│   ├── types/         # TypeScript型定義
│   └── hooks/         # カスタムフック
├── tests/             # テストコード
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.local         # ローカル環境変数（Git除外）
├── .env.example       # 環境変数テンプレート
└── package.json
```

## コーディング規約

### TypeScript
- 厳格な型定義を使用（`strict: true`）
- `any` の使用は最小限に（型が不明な場合は`unknown`）
- 型定義は `src/types/` に集約
- インターフェースよりも type を優先（一貫性のため）

### Next.js
- App Router を使用
- Server Components をデフォルトとし、必要な場合のみ Client Components (`'use client'`)
- API Routes は `/src/app/api/` に配置
- ルートグループで認証状態を分離: `(auth)`, `(protected)`

### コンポーネント
- 関数コンポーネントのみ使用
- ファイル名: PascalCase（例: `PostEditor.tsx`）
- 1ファイル1コンポーネントを原則
- Props型は同ファイル内で定義（型名: `ComponentNameProps`）
- デフォルトエクスポートを使用

```typescript
type PostEditorProps = {
  initialText?: string;
  onSubmit: (text: string) => void;
};

export default function PostEditor({ initialText, onSubmit }: PostEditorProps) {
  // ...
}
```

### 命名規則
- **ファイル/ディレクトリ**: kebab-case（例: `post-editor.tsx`, `user-profile/`）
- **コンポーネント**: PascalCase（例: `PostEditor`, `UserProfile`）
- **関数/変数**: camelCase（例: `getUserPosts`, `isLoading`）
- **定数**: UPPER_SNAKE_CASE（例: `MAX_POST_LENGTH`, `API_BASE_URL`）
- **型/インターフェース**: PascalCase（例: `Post`, `UserProfile`）

### インポート順序
1. React / Next.js
2. 外部ライブラリ
3. 内部モジュール（`@/`エイリアス使用）
4. 相対パス
5. 型インポート（`import type`）

```typescript
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { createPost } from '@/lib/x-api/posts';

import type { Post } from '@/types/post';
```

## API設計

### REST API規約
- エンドポイント: `/api/{resource}/{action}`
- メソッド: GET, POST, PUT, DELETE を適切に使用
- レスポンス形式: JSON
- エラーレスポンス: `{ error: string, details?: any }`

### 認証
- Supabase Auth のセッション管理を使用
- API Routesでは必ずセッション確認
- クライアント側: `createClientComponentClient()`
- サーバー側: `createServerComponentClient()`

### X API連携
- OAuth 2.0（自前実装）
- トークンは暗号化してSupabase DB保存
- リフレッシュトークン期限切れ時は再認可フローへ誘導

## データベース

### Supabase マイグレーション
- `supabase/migrations/` でバージョン管理
- ファイル名: `YYYYMMDDHHMMSS_description.sql`
- RLS（Row Level Security）を必ず設定
- 外部キー制約を適切に設定

### テーブル命名規則
- 複数形（例: `posts`, `users`, `x_tokens`）
- snake_case
- タイムスタンプ: `created_at`, `updated_at` を必ず含める

## セキュリティ

### 必須対策
- [ ] Xトークンは暗号化保存（サーバサイドのみ復号）
- [ ] RLS有効化 + API側でもユーザーID確認
- [ ] Cronエンドポイントはシークレット検証
- [ ] 環境変数に機密情報（本番は Vercel、ローカルは `.env.local`）
- [ ] `.env.local` は Git 除外

### 入力検証
- クライアント側とサーバー側の両方で実施
- 投稿文字数制限（X API制限に準拠）
- XSS対策（Reactのデフォルト動作に依存）
- SQL Injection対策（Supabaseのパラメータ化クエリ使用）

## テスト方針

### ユニットテスト
- テストフレームワーク: Jest + React Testing Library
- 対象: ユーティリティ関数、カスタムフック、ビジネスロジック
- カバレッジ目標: 主要ロジックは80%以上

### 統合テスト
- API Routes のテスト
- X API はモック（MSW使用）
- Supabase はローカル環境使用

### E2Eテスト
- フレームワーク: Playwright
- 対象: 主要導線のみ（ログイン→生成→予約→一覧）
- CI で実行

## Git運用

### ブランチ戦略
- `main`: 本番環境（Vercel自動デプロイ）
- `feature/*`: 機能開発ブランチ
- `fix/*`: バグ修正ブランチ

### コミットメッセージ
- 日本語OK
- 形式: `[種別] 簡潔な説明`
- 種別: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

例:
```
[feat] 投稿予約機能を実装
[fix] 予約時刻の丸め処理を修正
[docs] API設計をdocs/design/に追加
```

### PR運用
- feature → main の PR を作成
- Vercel Preview で動作確認
- マージ後は feature ブランチ削除

## 環境変数

### 必須環境変数（`.env.example` に記載）
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# X API
X_CLIENT_ID=
X_CLIENT_SECRET=
X_REDIRECT_URI=

# Encryption
ENCRYPTION_KEY=

# Vercel Cron (本番のみ)
CRON_SECRET=

# Stripe (後で追加)
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

## AI活用方針

### 設計フェーズ（Claude）
- 要件整理、アーキテクチャ判断
- セキュリティレビュー
- 設計ファイルは `docs/design/` に保存

### 実装フェーズ（Codex/Cursor）
- コード生成、UI実装
- 設計ファイルを参照して実装

### レビューフェーズ（Claude）
- コードレビュー、リファクタリング提案
- テスト観点の洗い出し

## 開発の進め方

### Day2〜Day30の基本フロー
1. **設計**: Claudeで設計ファイル作成（`docs/design/`に保存）
2. **実装**: Codex/Cursorで設計を元に実装
3. **レビュー**: Claude でレビュー、必要に応じて修正
4. **テスト**: テストコード追加
5. **記事**: note用の実装ログ作成

### 意思決定ルール
- 迷ったら「まず動く最小構成（MVP）」を優先
- 機能は段階的に追加（一度に詰め込まない）
- 自動リトライ、過度な最適化は後回し
- プレビュー必須（誤爆防止）

## 運用ルール（アプリ仕様）

### 予約投稿
- 10分刻み、JST固定
- 同時刻複数予約OK（投稿時に1分ずつずらす）
- Cron実行上限: 最大5件/回
- 失敗時: `failed` ステータス、手動再実行のみ

### メトリクス取得
- 1日1回Cronのみ
- 最新値のみ保存（推移は後回し）
- X API無料枠を前提（取得頻度を抑える）

### 投稿生成
- 日次上限あり（ユーザー単位）
- 採用案のみ保存
- 文字数超過はエラー表示→手修正

## 参考リンク
- [X API Documentation](https://developer.x.com)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Documentation](https://vercel.com/docs)
