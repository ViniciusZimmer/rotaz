# Git Workflow + CI/CD — Design Spec

> **For agentic workers:** Use superpowers:writing-plans to implement this spec.

**Goal:** Estabelecer fluxo de branches, proteções e pipeline CI/CD para o projeto Rotaz, com dois ambientes fixos (dev e prod) no Vercel.

**Architecture:** GitFlow-lite com `main` → prod e `dev` → staging. GitHub Actions para CI em PRs. Vercel conectado ao GitHub para deploy automático por branch.

**Tech Stack:** GitHub, GitHub Actions, Vercel, Next.js 16, Node.js 20

---

## Branches

| Branch | Propósito | Proteção |
|--------|-----------|----------|
| `main` | Produção | CI obrigatório, sem push direto, requer PR |
| `dev` | Staging | CI obrigatório, sem push direto, requer PR |
| `feat/*` | Features novas | Sem proteção — PR para `dev` |
| `fix/*` | Bugfixes | Sem proteção — PR para `dev` |
| `hotfix/*` | Correções urgentes de prod | Sem proteção — PR direto para `main` |
| `chore/*` | Infra, deps, docs | Sem proteção — PR para `dev` |

## Fluxo de Trabalho

### Feature / Fix
```
dev  →  feat/xxx  →  PR  →  dev  →  (acúmulo)  →  PR  →  main
```

### Hotfix
```
main  →  hotfix/xxx  →  PR  →  main
                              ↓
                        PR de sync: main → dev
```
Hotfix vai direto para `main`. Após merge, abrir PR de `main` → `dev` para sincronizar.

## CI — GitHub Actions

Arquivo: `.github/workflows/ci.yml`

Trigger: `pull_request` com `branches: [main, dev]`

Steps:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` — Node 20, cache npm
3. `npm ci`
4. `npm run lint`
5. `npm run build`

Env vars necessárias no CI (via GitHub Secrets — só segredos reais):
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ROTAS_BRASIL_TOKEN`
- `DATABASE_URL`

Vars com valores fixos definidas inline no workflow (não como secrets):
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/`
- `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/`

Sem suite de testes por ora — lint + build é o gate de qualidade.

## Vercel — Ambientes

| Branch | Ambiente | URL |
|--------|----------|-----|
| `main` | Production | domínio real (ex: `rotaz.app`) |
| `dev` | Preview estável | `rotaz-dev.vercel.app` ou subdomínio configurado |
| PRs / `feat/*` | Preview efêmero | URL gerada automaticamente por deploy |

### Env vars no Vercel por ambiente

| Var | Production | Preview |
|-----|-----------|---------|
| `DATABASE_URL` | DB prod | DB dev |
| `CLERK_SECRET_KEY` | app Clerk prod | app Clerk dev |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | app Clerk prod | app Clerk dev |
| `ROTAS_BRASIL_TOKEN` | token real | token real |
| `GOOGLE_MAPS_API_KEY` | chave real | chave real |

`dev` branch e PRs compartilham vars de Preview — sem problema para escala atual.

Nenhum `vercel.json` necessário (Next.js detectado automaticamente).

## Fluxo Completo

```
1. git checkout dev && git pull
2. git checkout -b feat/nome-feature
3. ... commits ...
4. PR: feat/nome-feature → dev
5. CI roda (lint + build) → Vercel Preview URL gerada
6. Merge → deploy automático em dev.rotaz.app
7. Acúmulo de features prontas
8. PR: dev → main
9. CI roda
10. Merge → deploy automático em rotaz.app
```

## O Que NÃO Está no Escopo

- Environments do Vercel (feature separada de Preview — não usar por enquanto)
- Release tags / CHANGELOG automatizado
- Deploy manual via CLI Vercel
- Múltiplos reviewers obrigatórios (só 1 aprovação necessária, ou auto-merge)
- Dependabot / renovate para deps
