# Calculadora de Frete — Como o sistema funciona

App web em Next.js que calcula automaticamente **distância, pedágio e tabela ANTT** para uma lista de rotas de caminhão, recebendo um Excel como entrada e devolvendo outro Excel preenchido.

---

## Fluxo principal

```
Excel (.xlsx)
    ↓
Leitura no browser (SheetJS)
    ↓
POST /api/calcular  ←  array de rotas (origem, destino, eixos)
    ↓
Para cada rota:
  1. Rotas Brasil API → KM + pedágio real por praça
  2. Cálculo ANTT (fórmula oficial)
  3. Frete Total = Pedágio + ANTT
    ↓
Tabela exibida na tela
    ↓
Exportar Excel preenchido
```

---

## Distância e pedágio — Rotas Brasil API

**Arquivo:** `lib/rotas-brasil.ts`

O sistema usa a API da [rotasbrasil.com.br](https://rotasbrasil.com.br), que retorna distância rodoviária real e **pedágio por praça**, específico para caminhões brasileiros.

- Token configurado em `.env.local` como `ROTAS_BRASIL_TOKEN`
- Parâmetros enviados: `pontos` (cidades), `veiculo=caminhao`, `eixo=<número>`, `tabela=a`
- Formato das cidades: `"São Paulo, SP"` → `"sao paulo,sp"` (sem acento, sem espaço após vírgula)
- Consome 1 crédito por rota única — por isso tem cache de 30 dias

**Fallback** (se não tiver token ou a API falhar):
1. Google Maps Distance Matrix API (se tiver `GOOGLE_MAPS_API_KEY`)
2. Haversine (distância em linha reta) × fator 1.35 de rodovias, usando coordenadas fixas de ~80 cidades brasileiras
3. Se a cidade não estiver no mapa fixo, assume 500 km

---

## Cache de rotas

**Arquivo:** `lib/route-cache.ts`

Para não gastar créditos repetindo a mesma consulta:

- Cache em memória (Map) + arquivo `.route-cache.json` na raiz do projeto
- TTL de 30 dias
- Chave: `"origem|destino|eixos"` (normalizado: minúsculas, sem acento)
- O arquivo `.route-cache.json` está no `.gitignore` — não vai pro repositório

Para limpar o cache (forçar recalcular tudo): `rm .route-cache.json`

---

## Cálculo ANTT

**Arquivo:** `lib/antt.ts`

Baseado na **Resolução nº 5.867/2020**, atualizada em 20/03/2026 (PORT.SUROC Nº 04/2026).

**Fórmula:**
```
Frete ANTT = (KM × CCD) + CC
```

- **CCD** = Coeficiente de custo de deslocamento (R$/km) — varia por eixos e tipo de carga
- **CC** = Coeficiente de custo fixo de carga/descarga (R$) — valor único por eixo/tipo

**Retorno vazio** (opcional):
```
+= 0,92 × KM × CCD
```

A tabela cobre **7 números de eixo** (2, 3, 4, 5, 6, 7, 9) × **7 tipos de carga**:

| Tipo de carga | Exemplo |
|---|---|
| Carga geral | Padrão, usado quando não informado |
| Frigorificado / Aquecido | Carnes, laticínios |
| Granel sólido | Grãos |
| Granel líquido | Combustíveis |
| Conteinerizada | Containers |
| Neogranel | Bobinas, madeira |
| Granel pressurizado | GLP, gases |

Se o número de eixos não for exato (ex: 8 eixos), usa o valor mais próximo disponível.

---

## Frete Total

```
Frete Total = Pedágio (Rotas Brasil) + ANTT
```

Calculado em `app/api/calcular/route.ts`.

---

## Formatos de Excel suportados

**Arquivo:** `app/page.tsx`

O sistema detecta automaticamente o formato na importação:

**Formato padrão** — colunas: `Cliente | Origem | Destino | UF | Eixos`

**Formato IA** — colunas: `Origem | (UF) | Destino | (UF) | (Eixos)` sem coluna de Cliente. Detectado quando existe coluna `Origem` mas não existe `Cliente`. O modelo de exemplo fica em `public/modelo.xlsx`.

---

## API Routes

| Rota | Método | O que faz |
|---|---|---|
| `/api/calcular` | POST | Recebe array de rotas, devolve com KM + pedágio + ANTT calculados |
| `/api/exportar` | POST | Recebe linhas calculadas, devolve arquivo `.xlsx` para download |
| `/api/modelo` | GET | Faz download do Excel modelo para o usuário preencher |

---

## Variáveis de ambiente

Arquivo `.env.local` (não vai pro git):

```
ROTAS_BRASIL_TOKEN=<token>      # obrigatório para pedágio real
GOOGLE_MAPS_API_KEY=<key>       # opcional, usado apenas no fallback de KM
```

---

## Estrutura de arquivos relevantes

```
app/
  page.tsx                  # Interface principal (upload, tabela, exportar)
  api/
    calcular/route.ts       # Orquestra KM + pedágio + ANTT por rota
    exportar/route.ts       # Gera Excel de saída
    modelo/route.ts         # Serve o arquivo modelo para download

lib/
  rotas-brasil.ts           # Integração com Rotas Brasil API
  route-cache.ts            # Cache em memória + arquivo JSON
  antt.ts                   # Tabela e cálculo ANTT (Resolução 5.867/2020)
  google-maps.ts            # Fallback: Google Maps ou Haversine
  pedagio.ts                # Fallback: estimativa de pedágio por km/eixo

types/
  frete.ts                  # Tipos TypeScript (LinhaFrete, TipoCarga, etc.)
```
