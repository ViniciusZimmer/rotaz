# Fundação SaaS — Design Spec

**Data:** 2026-05-24
**Módulo:** Fundação (pré-requisito de todos os outros módulos)
**Status:** Aprovado

---

## Contexto

O sistema atual é uma calculadora de frete single-page sem autenticação, persistência ou multi-usuário. Este spec define a Fundação que transforma a aplicação em uma base sólida para um SaaS completo, sem quebrar nenhuma funcionalidade existente.

**Usuários-alvo:** Transportadoras (uso interno, múltiplos usuários por empresa)
**Abordagem escolhida:** B — Clerk + Server Actions + API routes existentes mantidas

---

## Stack

| Camada | Tecnologia | Motivo |
|---|---|---|
| Framework | Next.js App Router (já existe) | - |
| Autenticação | Clerk | Multi-usuário, gestão de times, integração nativa com Next.js App Router, escalável para multi-tenant no futuro |
| Banco de dados | PostgreSQL + Prisma + Neon | SQL relacional para dados estruturados, Prisma gera tipos TypeScript, Neon é serverless com integração Vercel |
| Deploy | Vercel | Zero config para Next.js, preview deploys automáticos, integração com Neon |

---

## O que a Fundação entrega

1. Login/logout com email e senha (ou Google via Clerk)
2. Toda a aplicação protegida — sem login, sem acesso
3. Cada cotação calculada é salva automaticamente no banco
4. Base de dados pronta para os módulos futuros (histórico, clientes, dashboard)

## O que NÃO muda

- API routes `/api/calcular`, `/api/exportar`, `/api/modelo` — mantidas intactas
- Lógica de cálculo (`lib/antt.ts`, `lib/rotas-brasil.ts`, etc.) — não tocada
- Fluxo do usuário (upload → calcular → exportar) — idêntico, com login na frente e persistência automática ao final

---

## Arquitetura

### Estrutura de arquivos

```
middleware.ts                              ← intercepta todas as rotas, redireciona não-autenticados
app/
  layout.tsx                              ← ClerkProvider envolve toda a app
  sign-in/[[...sign-in]]/page.tsx         ← página de login (Clerk component)
  sign-up/[[...sign-up]]/page.tsx         ← página de cadastro
  (protected)/                            ← route group — tudo dentro requer auth
    layout.tsx                            ← verifica sessão ativa
    page.tsx                              ← calculadora atual (movida para cá)
lib/
  actions/
    cotacao.ts                            ← Server Action: salvarCotacao(linhas) — auth() chamado internamente
prisma/
  schema.prisma                           ← schema do banco
```

### Fluxo de autenticação

```
Usuário acessa qualquer rota
  ↓
middleware.ts verifica token Clerk
  ↓ não autenticado → redireciona /sign-in
  ↓ autenticado → acessa normalmente

Clerk gerencia: sessão, refresh de token, logout
Painel Clerk: admin adiciona/remove usuários sem código
```

### Fluxo de persistência

```
Usuário clica "Calcular"
  ↓
POST /api/calcular (já existe, sem mudança)
  ↓
Resultados exibidos na tela (imediato)
  ↓ em paralelo
Server Action salvarCotacao(linhas) — userId obtido via auth() server-side
  ↓
Prisma → PostgreSQL (Neon)
```

A persistência não bloqueia o fluxo: o usuário vê os resultados imediatamente.

---

## Schema do Banco (Prisma)

```prisma
model User {
  id        String    @id        // mesmo ID do Clerk
  email     String    @unique
  name      String?
  createdAt DateTime  @default(now())
  cotacoes  Cotacao[]
}

model Cotacao {
  id          String         @id @default(cuid())
  userId      String
  user        User           @relation(fields: [userId], references: [id])
  createdAt   DateTime       @default(now())
  formato     String         // "padrao" | "modeloIA"
  totalLinhas Int
  linhas      LinhaCotacao[]
}

model LinhaCotacao {
  id         String  @id @default(cuid())
  cotacaoId  String
  cotacao    Cotacao @relation(fields: [cotacaoId], references: [id])

  // dados da rota
  cliente    String
  origem     String
  destino    String
  uf         String
  eixos      Int

  // resultados
  km         Float?
  pedagio    Float?
  antt       Float?
  freteTotal Float?
  status     String  // "ok" | "erro"
  erro       String?
}
```

---

## Variáveis de Ambiente

| Variável | Origem | Uso |
|---|---|---|
| `ROTAS_BRASIL_TOKEN` | já existe | API de KM/pedágio |
| `GOOGLE_MAPS_API_KEY` | já existe | fallback de KM |
| `DATABASE_URL` | Neon dashboard | conexão Prisma |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard | client-side |
| `CLERK_SECRET_KEY` | Clerk dashboard | server-side |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | fixo `/sign-in` | redirect auth |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | fixo `/sign-up` | redirect auth |

---

## Ambientes

| Branch | Ambiente | Banco | Clerk |
|---|---|---|---|
| `main` | Produção | Neon prod branch | Clerk prod instance |
| feature branches | Preview (URL única) | Neon dev branch | Clerk dev instance |

O Neon tem integração oficial com Vercel: um clique conecta o banco e injeta `DATABASE_URL` automaticamente em cada ambiente.

---

## Entregáveis

1. Clerk instalado e configurado — middleware protege todas as rotas
2. Páginas `/sign-in` e `/sign-up` funcionando
3. Calculadora movida para route group `(protected)`
4. Prisma + Neon conectados com schema migrado
5. Server Action `salvarCotacao` chamada após cada cálculo bem-sucedido
6. Deploy no Vercel com todas as variáveis configuradas por ambiente

---

## Módulos futuros (fora do escopo deste spec)

- Histórico de cotações (busca, filtros, revisão)
- Gestão de clientes e contratos
- Dashboard e analytics
- Multi-tenant (múltiplas transportadoras)
