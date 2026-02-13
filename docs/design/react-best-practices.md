# React Best Practices（Vercel公式）

## 概要

Vercelが10年以上のReact/Next.js最適化の知見をまとめた「react-best-practices」リポジトリについての公式ブログ記事の要点をまとめます。このリポジトリは、AIエージェント（Cursor、Claude Code、Codex等）向けに最適化されており、パフォーマンス問題を体系的に解決するためのフレームワークを提供します。

## 情報源

- **公式ブログ記事**: [Introducing: React Best Practices](https://vercel.com/blog/introducing-react-best-practices)
- **公開日**: 2026年1月14日
- **著者**: Shu Ding（Software Engineer）、Andrew Qu（Chief of Software, Vercel）
- **GitHubリポジトリ**: `vercel-labs/react-best-practices`
- **Agent Skills**: `vercel-labs/agent-skills` - Cursor、Claude Code、Codex等で使用可能

## コアコンセプト：優先順位付け

パフォーマンス作業の多くは、スタックの低いレベルから始まるため失敗します。最も影響の大きい修正から優先順位を付けて実行することが重要です。

### 優先順位の高い修正（CRITICAL）

1. **ウォーターフォールの解消**: 非同期処理が意図せず順次実行される問題を解決
2. **バンドルサイズの削減**: ページごとに送信されるJavaScriptのサイズを最適化

この2つが実世界のメトリクスに最も影響を与えます。

### パフォーマンス作業の連鎖効果

小さな性能劣化でも、毎回のセッションに長期的な負担として蓄積します。今日出荷した小さな劣化は、誰かが修正するまで負債として残り続けます。

## 8つのパフォーマンスカテゴリ

リポジトリには40以上のルールが、影響度順（CRITICALからLOWまで）に整理されています：

1. **Eliminating async waterfalls**（非同期ウォーターフォールの解消）
2. **Bundle size optimization**（バンドルサイズの最適化）
3. **Server-side performance**（サーバーサイドパフォーマンス）
4. **Client-side data fetching**（クライアントサイドデータ取得）
5. **Re-render optimization**（再レンダリングの最適化）
6. **Rendering performance**（レンダリングパフォーマンス）
7. **Advanced patterns**（高度なパターン）
8. **JavaScript performance**（JavaScriptパフォーマンス）

各ルールには影響度評価と、問題のあるコードと修正後のコード例が含まれています。

## 実例：よくある問題パターン

### 例：不要なコードブロック

**問題のあるコード（両方のブランチをブロック）:**

```typescript
async function handleRequest(userId: string, skipProcessing: boolean) {
  const userData = await fetchUserData(userId)
  
  if (skipProcessing) {
    // 即座に返すが、userDataを待ってしまう
    return { skipped: true }
  }
  
  // このブランチのみがuserDataを使用
  return processUserData(userData)
}
```

**修正後（必要な時のみブロック）:**

```typescript
async function handleRequest(
  userId: string,
  skipProcessing: boolean
) {
  if (skipProcessing) {
    return { skipped: true }
  }
  
  const userData = await fetchUserData(userId)
  return processUserData(userData)
}
```

### 実際のプロダクション事例

**ループ反復の結合**
- チャットページが同じメッセージリストを8回スキャンしていた
- 単一パスに統合することで、数千メッセージがある場合に大きな改善

**awaitの並列化**
- APIが相互に依存しないデータベース呼び出しを順次実行していた
- 並列実行することで、総待機時間を半分に削減

**遅延ステート初期化**
- コンポーネントが毎レンダリングで`localStorage`からJSON設定を解析していた
- コールバックでラップ（`useState(() => JSON.parse(...))`）することで無駄な処理を排除

## AIエージェントでの活用方法

### Agent Skillsの導入

これらのベストプラクティスは、Agent Skillsとして各種コーディングエージェントにインストールできます：

```bash
npx add-skill vercel-labs/agent-skills
```

サポートされているエージェント：
- OpenCode
- Codex
- Claude Code
- Cursor
- その他のコーディングエージェント

### AGENTS.md

個別のルールファイルは`AGENTS.md`という単一ドキュメントにコンパイルされ、エージェントがコードレビューや最適化提案の際に参照できます。AIエージェントによるリファクタリング時にも一貫して適用できるよう設計されています。

## Next.js開発者への適用

### 特に重要なポイント

- **CRITICAL優先度の最適化**: ウォーターフォール解消とバンドルサイズ削減は、Next.jsのRSCやApp Routerと組み合わせることで、初期ロード性能に大きな改善をもたらします
- **Server-Side Performance**: Next.jsのSSRやServer Componentsの活用が増える中、サーバー側の応答時間とリソース使用の最適化はコスト削減とスケーラビリティに直結します
- **Client-Side Data Fetching**: App RouterやPages Routerでクライアント側データ取得が必要な場合、React Query、SWR、Suspenseを適切に使用することで、再描画や状態管理のオーバーヘッドを防げます

### 適用の進め方

1. **Agent Skillsの導入**: 開発環境にAgent Skillsを追加し、コードベースに適用できるルールを確認
2. **優先度順に適用**: CRITICALカテゴリ（ウォーターフォール解消、バンドルサイズ削減）から着手
3. **コードレビューに組み込み**: プルリクエストテンプレートやコードレビューチェックリストにベストプラクティス項目を追加
4. **定量的な確認**: Lighthouse、Web Vitals、Bundle Analyzer等で改善を測定

## 注意点と考慮事項

### トレードオフ

- 最適化は開発速度や保守性と衝突することがある
- 外部ライブラリや複雑なUI要件がある場合、過度なコード分割はリファクタリングコストを増やす可能性がある

### プロジェクト規模

- 小規模アプリや社内ツールでは、過度な最適化はコスト過多になることも
- モバイルユーザーが主要なターゲットか、高遅延ネットワークで使用されるかを考慮して優先度を設定

### 技術の進化

- Next.jsやReactのアップデートにより、有効だったルールが将来的に最適でなくなる可能性がある
- 定期的に最新のベストプラクティスを確認

## 関連情報

- [Vercel公式ブログ: Introducing React Best Practices](https://vercel.com/blog/introducing-react-best-practices)
- GitHubリポジトリ: `vercel-labs/react-best-practices`
- Agent Skills: `vercel-labs/agent-skills`
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Conformance Rules](https://vercel.com/docs/conformance/rules)

## 更新履歴

- 2026-01-XX: 初版作成（Vercel公式ブログ記事に基づく）
