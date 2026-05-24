# Rotaz — Identidade de Produto & Redesign de UI

**Data:** 2026-05-24
**Status:** Aprovado

---

## Contexto

O produto atual é uma calculadora de frete sem identidade de marca, com UI funcional mas genérica. O objetivo é transformá-lo em um SaaS comercial para transportadoras, com nome, identidade visual e usabilidade redesenhados para dois perfis de usuário: analistas (uso diário intenso) e gerentes de logística (visão rápida, decisão).

Diferenciais do produto que a identidade deve comunicar:
- Múltiplos provedores de rota com comparação de precisão
- Cálculo ANTT completo — 28 variações por rota, matematicamente correto

---

## Nome & Posicionamento

**Nome:** Rotaz

**Tagline:** *"Calcule rotas. Feche fretes."*

**Raciocínio:** Rota + sufixo -az. Curto, energético, nacional, único no mercado. Fácil de dizer e lembrar. Escala bem como domínio SaaS.

---

## Identidade Visual

### Paleta de Cores

| Papel | Nome | Hex |
|-------|------|-----|
| Background principal | Azul-noite | `#0B1120` |
| Surface / cards | Azul-escuro | `#111827` |
| Borda sutil | Slate | `#1F2937` |
| Acento primário | Sky | `#0EA5E9` |
| Acento secundário | Sky escuro | `#0284C7` |
| Texto principal | Branco suave | `#F1F5F9` |
| Texto secundário | Slate | `#94A3B8` |
| Sucesso / confiança alta | Verde | `#22C55E` |
| Alerta / divergência | Âmbar | `#F59E0B` |
| Erro | Vermelho | `#EF4444` |

Dark mode como padrão único — sem toggle light/dark.

### Tipografia

**Inter** (já presente no projeto). Hierarquia:

- Título de página: `text-2xl font-semibold tracking-tight`
- Label de seção: `text-xs font-medium uppercase tracking-widest text-slate-500`
- Dado principal (km, valor): `text-lg font-mono tabular-nums`
- Dado secundário: `text-sm text-slate-400`

Todos os números monetários e KM usam `font-mono tabular-nums` para alinhamento e aparência de ferramenta de precisão.

### Logo

- Wordmark: **Rotaz** em Inter Semibold, cor `#F1F5F9`
- Versão compacta / favicon: `Rz` em `#0EA5E9` (sky) sobre fundo `#0B1120`
- `<title>` dinâmico por página: `Rotaz — Calculadora`, `Rotaz — Validação`

---

## Arquitetura de UI

### Estrutura de páginas

```
/            → Calculadora principal
/validacao   → Comparação avulsa de provedores
/historico   → [futuro] cotações salvas
```

### Top Bar (fixa)

```
[Rz] Rotaz    Calculadora  Validação    [⚙ Configurações]  [Avatar]
```

- Configurações abre side panel dedicado com toggle de provedores ativos e status de tokens de API
- Remove o popover flutuante atual

---

## Página Principal — 3 Zonas

### Zona 1 — Upload

Área grande de drag & drop:

```
┌─────────────────────────────────────────┐
│  ↑  Arraste o Excel aqui                │
│     ou clique para selecionar           │
│                                         │
│  [Formato padrão]  [Formato IA]         │
└─────────────────────────────────────────┘
```

Após upload: substitui por barra com nome do arquivo + `n rotas carregadas` + botão X para limpar.

Empty state inicial exibe:
> "Sem dados ainda. Faça upload de um Excel para começar, ou [baixe o modelo →]"

### Zona 2 — Ações

Barra horizontal com botões sequenciais:

```
[Calcular KM · Pedágio · ANTT]  [Comparar provedores (n)]  [Exportar Excel ↓]
```

- Botões desabilitados com tooltip explicativo antes de cada pré-condição ser atendida
- Progresso inline substituindo o botão durante execução: `Calculando rota 3/47…` + barra de progresso
- Loading states com skeleton em vez de spinner solto

### Zona 3 — Tabela de Resultados

Colunas visíveis na linha:

```
Origem → Destino  |  KM  |  Pedágio (ref. 6 eixos)  |  Frete mín. ANTT  |  Fonte  |  ›
```

- Badge de fonte visível na linha (não só no accordion): `HERE ●` em sky, `estimativa ●` em âmbar
- Linha com `pedagio === 0`: ícone ⚠ na coluna Pedágio
- Linha com divergência >10% entre provedores: fundo âmbar

#### Hierarquia visual de estados

| Estado | Tratamento |
|--------|-----------|
| Confiança alta | Badge verde |
| Confiança média | Badge âmbar, tooltip "validar" |
| Confiança baixa | Badge vermelho, linha destacada |
| Divergência >10% entre provedores | Fundo âmbar na row |
| Pedágio zero | Ícone ⚠ na coluna Pedágio |

---

## Accordion Expandido — Layout Novo

Duas colunas lado a lado:

```
┌──────────────────────────────┬──────────────────────────┐
│  Grade ANTT (7×4)            │  Comparação Provedores   │
│  Eixos | Simpl | Comp | ...  │  HERE    340km  R$87,00  │
│                              │  TomTom  338km  R$91,00  │
│                              │  R.Bras  341km  R$89,00  │
│                              │                          │
│  Praças (collapsed por       │  ● Alta confiança        │
│  padrão, expandível)         │                          │
└──────────────────────────────┴──────────────────────────┘
```

A coluna direita (Comparação) só aparece se `linha.comparacao` estiver populado. Caso contrário, o accordion ocupa largura total (apenas grade ANTT + praças).

---

## Página /validacao — Upgrades

Além do form + tabela atual, adicionar:

1. **Histórico de sessão** — últimas 5 rotas comparadas, armazenado em `sessionStorage` (persiste dentro da aba até fechar, perdido ao navegar para outra aba)
2. **Coluna delta** — `vs. melhor provedor`: `+R$12,00 (+14%)` em âmbar para linhas divergentes
3. **Botão "Usar no frete"** — navega para `/` com query params `?origem=X&destino=Y&eixos=N`; a calculadora principal lê esses params no mount e pré-popula um campo de entrada manual (a ser implementado junto com esta feature)

---

## Micro-detalhes de Polish

- KM sem casas decimais (`341 km`, não `341.2 km`)
- Transições `transition-colors duration-150` em hovers
- Skeleton loading em vez de spinner solto
- `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })` em todos os valores monetários (já existe, manter)

---

## O que NÃO muda

- Stack: Next.js 16, React 19, Tailwind CSS, Clerk — sem alteração
- Lógica de negócio: ANTT, provedores, cache, tipos — inalterada
- Estrutura de rotas Next.js: `/`, `/validacao`
- Banco de dados e actions
