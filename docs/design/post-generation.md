# LLM投稿案生成設計

## 概要
ユーザーの箇条書き入力からX投稿案をLLMで生成する。
プロバイダは後で選定、まず動く形で実装し、プロバイダ差し替え可能な設計にする。

## 前提
- 入力: 自由な箇条書きテキスト
- 出力: 5案（内訳: 型ごとに最適化）
- 日次上限: ユーザー単位で制限（回数 or トークン）
- プロフィール興味カテゴリを生成に反映

---

## 生成フロー

### 1. ユーザー入力
**UI**:
- テキストエリア（最大1000文字）
- 「生成」ボタン

**入力例**:
```
今日学んだこと
- TypeScriptの型推論
- Next.jsのApp Router
- Supabaseの認証
```

### 2. バリデーション
- `input_text`: 1-1000文字
- 日次上限チェック（`generation_history` テーブル）

**日次上限ロジック**:
```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);

const { count } = await supabase
  .from('generation_history')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .gte('created_at', today.toISOString());

if (count >= DAILY_LIMIT) {
  throw new Error('Daily generation limit exceeded');
}
```

### 3. プロンプト構築
**プロンプトテンプレート**:
```
あなたはXのプロフェッショナル投稿ライターです。
以下のメモから、エンゲージメントの高いX投稿案を5つ作成してください。

## ユーザーの興味カテゴリ
{interest_categories}

## メモ
{input_text}

## 出力形式
JSON形式で5つの投稿案を生成してください。
各投稿案には「content」と「post_type」を含めてください。

post_typeは以下のいずれか:
- dev_log: 開発ログ（学びや進捗の共有）
- tips: 実用的なTips（ハウツー、便利技）
- failure_story: 失敗談（詰まった点、解決策）
- comparison: 比較・検証（AとBを比較、メリット/デメリット）

## 制約
- 各投稿は280文字以内
- 絵文字は控えめに
- ハッシュタグは最大2個まで
- 読みやすく、行動を促す内容

## 出力例
```json
{
  "posts": [
    {
      "content": "今日はTypeScriptの型推論を深掘り。any を使わずに型安全に書く方法が分かった。",
      "post_type": "dev_log"
    },
    ...
  ]
}
```
```

**プロンプト構築関数**:
```typescript
export function buildPrompt(inputText: string, interestCategories: string[]): string {
  const categoriesText = interestCategories.length > 0
    ? interestCategories.join(', ')
    : '技術全般';

  return `あなたはXのプロフェッショナル投稿ライターです。
以下のメモから、エンゲージメントの高いX投稿案を5つ作成してください。

## ユーザーの興味カテゴリ
${categoriesText}

## メモ
${inputText}

...（省略）`;
}
```

### 4. LLM呼び出し
**プロバイダ抽象化**:
```typescript
// src/lib/llm/provider.ts
export interface LLMProvider {
  generate(prompt: string): Promise<LLMResponse>;
}

export type LLMResponse = {
  posts: Array<{
    content: string;
    post_type: 'dev_log' | 'tips' | 'failure_story' | 'comparison';
  }>;
  tokensUsed?: number;
};
```

**OpenAI実装例**:
```typescript
// src/lib/llm/openai-provider.ts
import OpenAI from 'openai';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generate(prompt: string): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);

    return {
      posts: parsed.posts,
      tokensUsed: response.usage?.total_tokens,
    };
  }
}
```

**Anthropic実装例**:
```typescript
// src/lib/llm/anthropic-provider.ts
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generate(prompt: string): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].text;
    const parsed = JSON.parse(content);

    return {
      posts: parsed.posts,
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
    };
  }
}
```

**プロバイダ選択**:
```typescript
// src/lib/llm/index.ts
import { OpenAIProvider } from './openai-provider';
import { AnthropicProvider } from './anthropic-provider';

export function getLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || 'openai';

  switch (provider) {
    case 'openai':
      return new OpenAIProvider();
    case 'anthropic':
      return new AnthropicProvider();
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
```

### 5. レスポンスパース・バリデーション
```typescript
// src/lib/llm/validator.ts
import { z } from 'zod';

const PostSchema = z.object({
  content: z.string().min(1).max(280),
  post_type: z.enum(['dev_log', 'tips', 'failure_story', 'comparison']),
});

const LLMResponseSchema = z.object({
  posts: z.array(PostSchema).min(1).max(10),
});

export function validateLLMResponse(data: unknown): LLMResponse {
  return LLMResponseSchema.parse(data);
}
```

### 6. 履歴保存
```typescript
await supabase.from('generation_history').insert({
  user_id: userId,
  input_text: inputText,
  generated_count: response.posts.length,
  tokens_used: response.tokensUsed,
});
```

### 7. レスポンス返却
```json
{
  "data": {
    "posts": [
      {
        "content": "今日はTypeScriptの型推論を深掘り...",
        "post_type": "dev_log"
      },
      ...
    ],
    "remaining_quota": 15
  }
}
```

---

## 改善案生成（分析ベース）

### 概要
メトリクス分析結果を元に、次の投稿案を自動生成する。

### 入力データ
1. **直近の成績**:
   - 型別の平均エンゲージメント
   - 時間帯別の平均エンゲージメント
   - ベストパフォーマンス投稿

2. **ユーザーメモ**:
   - 次に投稿したい内容の箇条書き

### プロンプトテンプレート
```
あなたはX運用のコンサルタントです。
以下のデータを元に、エンゲージメントを最大化する投稿案を3つ作成してください。

## 分析結果
- 最も反応が良い投稿タイプ: {best_post_type}
- 最も反応が良い時間帯: {best_hour}
- 平均エンゲージメント: {avg_engagement}

## ベストパフォーマンス投稿
{best_post_content}

## 次に投稿したい内容
{input_text}

## 提案
上記を踏まえて、以下の形式で投稿案を3つ生成してください:
- post_type は {best_post_type} を優先
- 投稿時間は {best_hour} 時台を推奨
- ベストパフォーマンス投稿の要素を取り入れる

（出力形式は通常生成と同じ）
```

---

## エラーハンドリング

### 想定されるエラー

| エラー | 原因 | 対応 |
|--------|------|------|
| LLM APIエラー | レート制限、APIキー不正 | リトライ（最大3回）、失敗時はエラー表示 |
| パースエラー | JSON不正、スキーマ不一致 | エラーログ記録、ユーザーに再試行を促す |
| 日次上限超過 | 生成回数オーバー | `429 Too Many Requests`、残り時間を表示 |
| 文字数超過 | LLMが280文字超の投稿を生成 | フィルタリングして除外、再生成は不要 |

### エラー時の挙動
- ユーザーにはフレンドリーなメッセージ表示
- サーバーログに詳細を記録
- リトライ可能なエラーは自動リトライ（最大3回）

---

## 日次上限管理

### 無料/有料の境界線（後で調整可能）
```typescript
const DAILY_LIMITS = {
  free: 10,
  basic: 50,
  pro: 200,
};

function getDailyLimit(plan: string): number {
  return DAILY_LIMITS[plan] || DAILY_LIMITS.free;
}
```

### 上限チェック
```typescript
const limit = getDailyLimit(user.plan);
const used = await countTodayGenerations(userId);
const remaining = limit - used;

if (remaining <= 0) {
  throw new Error('Daily generation limit exceeded');
}
```

### UI表示
```
残り生成回数: 15 / 50
```

---

## プロンプト改善の方針

### MVP段階
- シンプルなプロンプトで開始
- 5案生成、型バランスは固定（dev_log: 2, tips: 1, failure_story: 1, comparison: 1）

### 将来的な改善
- ユーザーフィードバック（採用率）を学習
- Few-shot examples追加
- 型ごとのプロンプト最適化
- ユーザー固有のトーン学習

---

## セキュリティ要件

- ✅ APIキーは環境変数で管理
- ✅ 日次上限でコスト制御
- ✅ ユーザー入力のサニタイズ（プロンプトインジェクション対策）
- ✅ レート制限（生成API）

---

## テスト観点

- [ ] 正常フロー: 入力 → 生成 → 5案返却
- [ ] バリデーション: 不正な入力でエラー
- [ ] 日次上限: 上限超過時に429エラー
- [ ] LLMエラー: APIエラー時のリトライ
- [ ] パースエラー: 不正なJSON時のエラーハンドリング
- [ ] プロバイダ切り替え: OpenAI ↔ Anthropic

---

## 実装時の注意点

1. **プロバイダ抽象化**: 将来的に切り替えやすい設計
2. **タイムアウト**: LLM呼び出しは30秒でタイムアウト
3. **ログ**: 生成内容をログに記録（デバッグ・改善用）
4. **コスト管理**: トークン数を記録、コスト試算に使用
5. **ユーザーフィードバック**: 採用率を記録、プロンプト改善に活用

---

## パフォーマンス最適化

### キャッシュ戦略（将来）
- 同じ入力に対する生成結果をキャッシュ（TTL: 1時間）
- キャッシュヒット率を測定

### バッチ生成（将来）
- 複数ユーザーの生成リクエストをまとめて処理
- コスト削減、レート制限回避

---

## 参考
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [Anthropic API Documentation](https://docs.anthropic.com/claude/reference)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)
