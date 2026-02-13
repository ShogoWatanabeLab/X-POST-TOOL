# Skill運用フロー（PDCA）

このドキュメントは、`x-post-tool/.codex/skills/` 配下のSkillを使った開発運用フローを定義します。

## 目的
- 要件整理、実装、レビューを分離して品質を安定化する
- スコープ逸脱を防ぎ、受け入れ条件ベースで進行する
- 次のタスク決定を一貫した形式で残す

## 使用するSkill
- `$task-scope-planner`: 要件から次タスクと実施範囲（In/Out Scope）を決める
- `$x-post-implementer`: In Scopeタスクのみ実装する
- `$x-post-reviewer`: 実装を受け入れ条件基準でレビューする

## 標準フロー
1. Plan: `$task-scope-planner`
2. Do: `$x-post-implementer`
3. Check: `$x-post-reviewer`
4. Act: レビュー結果を反映して、必要なら再度 `$task-scope-planner`

## 実行例
1. `"$task-scope-planner で docs/design を読んで次タスクとIn/Out Scopeを決めて"`
2. `"$x-post-implementer この計画のIn Scopeだけ実装して"`
3. `"$x-post-reviewer この実装を受け入れ条件基準でレビューして"`

## 運用ルール
- 重要な実装前は必ず Plan を経由する
- 実装は In Scope に限定し、Out of Scope は着手しない
- レビュー指摘が軽微なら実装に直接戻って修正してよい
- 指摘が設計変更を伴う場合は Plan へ戻る

## 保存先
- Skill本体: `x-post-tool/.codex/skills/`
- 設計資料: `docs/design/`
- 実装指示: `docs/instructions/codex.md`
