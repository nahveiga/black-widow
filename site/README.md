# Black Widow — Robô de Combate

Site do projeto acadêmico **Black Widow**, robô de combate da disciplina de
Sistemas Autônomos e Robótica — Engenharia da Computação, Universidade São
Francisco.

HTML, CSS e JavaScript puros. **Sem framework, sem build, sem npm.** Abre com
duplo clique e sobe no GitHub Pages sem nenhuma configuração.

---

## Sumário

- [Como rodar localmente](#como-rodar-localmente)
- [Estrutura de arquivos](#estrutura-de-arquivos)
- [Como atualizar o status das etapas](#como-atualizar-o-status-das-etapas)
- [Como trocar as fotos](#como-trocar-as-fotos)
- [O hero e seus 4 modos](#o-hero-e-seus-4-modos)
- [Como gerar os 36 frames a partir de um CAD](#como-gerar-os-36-frames-a-partir-de-um-cad)
- [Como publicar no GitHub Pages](#como-publicar-no-github-pages)
- [Decisões de projeto](#decisões-de-projeto)

---

## Como rodar localmente

### Opção 1 — duplo clique

Basta abrir o `index.html`. Funciona, **com duas limitações** causadas pelo
protocolo `file://` (o navegador bloqueia leitura de arquivos locais por
política de segurança — não é defeito do site):

| Recurso | Com duplo clique | Com servidor |
|---|---|---|
| Páginas, textos, fotos, vídeo, galeria, etapas | ✅ funciona | ✅ funciona |
| Download da planilha | ✅ funciona | ✅ funciona |
| **Preview** da planilha na tela | ❌ mostra aviso explicativo | ✅ funciona |
| **Hero em 3D** (robô girando) | ❌ cai no parallax | ✅ funciona |

### Opção 2 — servidor local (recomendado)

Dentro da pasta `site/`, rode:

```bash
python -m http.server 8000
```

E abra <http://localhost:8000>. Para parar, `Ctrl+C`.

> Se `python` não for reconhecido, tente `python3 -m http.server 8000` ou
> `py -m http.server 8000`.

---

## Estrutura de arquivos

```
site/
├── index.html                  Visão geral: hero, resumo, ficha técnica,
│                               galeria, vídeo e integrantes
├── etapas.html                 Linha do tempo do projeto
├── orcamento.html              Preview + download da planilha
│
├── css/
│   └── estilo.css              Folha de estilo única, dividida em 15 seções
│
├── js/
│   ├── comum.js                Lightbox, ano do rodapé, progressive enhancement
│   ├── dados-etapas.js         ⭐ AS ETAPAS DO PROJETO (edite só este)
│   ├── etapas.js               Monta a timeline e calcula o progresso
│   ├── hero.js                 Hero com rotação controlada pelo scroll
│   ├── orcamento.js            Leitura da planilha com SheetJS
│   └── r3-model.js             Modelo 3D do robô, montado por código
│
├── img/
│   ├── prototipo.jpg/.webp     Prancha de concepção (vistas técnicas)
│   ├── robo-montado.jpg/.webp  Foto da montagem atual
│   ├── poster-video.jpg/.webp  Poster do vídeo
│   └── og-image.jpg            Imagem de compartilhamento (link preview)
│
├── videos/
│   └── funcionamento.mp4       Ensaio de acionamento dos motores
│
├── arquivos/
│   └── orcamento-black-widow.xlsx
│
├── favicon.svg / favicon.ico / apple-touch-icon.png
│
└── referencia-prototipo-rotativo/   Material de referência (NÃO faz parte
                                     do site; ver "Decisões de projeto")
```

> **Nomes de arquivo:** todos em minúsculas, sem espaços e sem acentos
> (kebab-case). Espaço em nome de arquivo vira `%20` na URL e quebra em
> servidor Linux, que diferencia maiúsculas de minúsculas. Mantenha o padrão
> ao adicionar arquivos novos.

---

## Como atualizar o status das etapas

Abra **`js/dados-etapas.js`**. É o único lugar a editar. A porcentagem, a barra
de progresso e os contadores são **calculados** a partir desse array — não
existe número escrito à mão para desatualizar.

Para mudar uma etapa, troque só o campo `status`:

```js
{
  titulo: "Testes de movimentação e calibração dos motores",
  status: "andamento",        // era "pendente"
  nota: "Opcional: texto de apoio abaixo do título."
}
```

Os três valores possíveis:

| `status` | Aparência |
|---|---|
| `"concluido"` | verde, ícone ✓, título riscado, opacidade menor |
| `"andamento"` | vermelho, ícone ●, pulsando, destaque maior |
| `"pendente"` | cinza, ícone ○, contorno tracejado |

Para **acrescentar** uma etapa, copie um bloco `{ ... }` e coloque na posição
cronológica desejada — a numeração ("ETAPA 07") é gerada automaticamente.

**Como a porcentagem é calculada:** etapa concluída vale 1 ponto, etapa em
andamento vale 0,5 e pendente vale 0. Hoje: 6 concluídas + 3 em andamento em
15 etapas = `(6 + 1,5) / 15` = **50%**. Para contar só as concluídas, mude a
linha do `var pontos` em `js/etapas.js`.

---

## Como trocar as fotos

1. Coloque o arquivo novo em `img/` com nome em kebab-case sem acentos.
2. Gere a versão `.webp` (o site serve WebP para quem suporta e JPG como
   reserva). Com Python e Pillow:

   ```bash
   python -c "from PIL import Image; im=Image.open('img/foto.jpg').convert('RGB'); im.save('img/foto.webp','WEBP',quality=82,method=6)"
   ```

3. Atualize o `<picture>` correspondente no HTML — são três coisas por imagem:

   ```html
   <picture>
     <source srcset="img/foto.webp" type="image/webp">
     <img src="img/foto.jpg"
          alt="Descreva o que aparece na foto."
          width="1200" height="1600" loading="lazy" decoding="async">
   </picture>
   ```

   - **`alt`** — obrigatório, descreva o conteúdo (não escreva "foto de...").
   - **`width`/`height`** — as dimensões reais em pixels. Elas reservam o
     espaço e evitam que o texto "salte" quando a imagem carrega.
   - **`loading="lazy"`** — em toda imagem **fora** do hero.

4. Na galeria, atualize também os atributos `data-src`, `data-alt` e
   `data-legenda` do `<button>`, que alimentam o lightbox.

---

## O hero e seus 4 modos

O hero (`js/hero.js`) detecta sozinho o melhor modo disponível, **na ordem**:

| # | Modo | Ativa quando existe | O que faz |
|---|---|---|---|
| 1 | **Frames** | `img/frames/frame-001.webp` | Sequência de imagens em `<canvas>`, índice do frame controlado pelo scroll |
| 2 | **3D (.glb)** | `models/robo.glb` | Carrega o modelo com three.js + GLTFLoader |
| 3 | **3D procedural** | `js/r3-model.js` | ⬅ **é o que roda hoje.** Modelo montado por código |
| 4 | **Parallax** | sempre | Último recurso: parallax + escala + inclinação 3D sutil em `img/prototipo.jpg` |

### Forçar um modo (para testar)

Acrescente `?hero=` na URL:

```
index.html?hero=frames      index.html?hero=3d
index.html?hero=modelo      index.html?hero=fallback
index.html?hero=estatico
```

O selo no canto superior direito do hero mostra o modo ativo — útil para
confirmar o que está rodando.

### Acessibilidade e performance vêm antes do efeito

O hero exibe a **imagem estática**, sem efeito nenhum, quando:

- o sistema está com **`prefers-reduced-motion`** ligado (Windows: *Configurações
  → Acessibilidade → Efeitos visuais → Animações*);
- a **economia de dados** do navegador está ativa;
- a tela é estreita (< 640px) **e** o aparelho é fraco (≤ 4 núcleos ou ≤ 4 GB).

Se a pessoa ligar a preferência de movimento reduzido com o site aberto, o
efeito é desligado na hora, sem recarregar.

---

## Como gerar os 36 frames a partir de um CAD

O **modo 1 (frames)** é o mais leve e previsível: não baixa three.js
(~1,4 MB), não depende de WebGL e roda igual em qualquer aparelho. Para
ativá-lo, basta criar a pasta — **nenhuma linha de código muda**.

### 1. Exportar as imagens do CAD

Gire o modelo em torno do eixo **vertical**, em passos de **10°**
(360° ÷ 36 = 10°), e exporte uma imagem por posição. O importante é que
**só o robô gire** — câmera, luzes, distância e enquadramento ficam fixos,
senão a sequência "pula" ao rolar.

| Programa | Como fazer |
|---|---|
| **Fusion 360** | *Render → Turntable*, 36 quadros, 1 volta, fundo transparente |
| **SolidWorks** | *Motion Study* girando o conjunto 360°, salvar 36 quadros (PhotoView 360) |
| **Blender** | Câmera fixa; no objeto, `Rotation Z` com keyframe 0° no frame 1 e 360° no frame 37, interpolação **linear**; render frames 1–36, filme transparente |
| **Onshape** | Exportar vistas a cada 10° manualmente |

Dica: renderize em **quadrado** (ex.: 1200×1200) e com **fundo transparente**,
para o glow vermelho do site aparecer atrás do robô.

### 2. Renomear para `frame-001` … `frame-036`

A numeração precisa ter **3 dígitos com zero à esquerda**. Se o CAD exportou
`render0001.png`, `render0002.png`…:

```bash
# Git Bash / Linux / macOS, dentro da pasta dos renders
i=1
for f in $(ls *.png | sort); do
  mv "$f" "$(printf 'frame-%03d.png' "$i")"
  i=$((i + 1))
done
```

```powershell
# PowerShell
$i = 1
Get-ChildItem *.png | Sort-Object Name | ForEach-Object {
  Rename-Item $_.FullName ("frame-{0:d3}.png" -f $i); $i++
}
```

### 3. Converter para WebP e colocar em `img/frames/`

WebP pesa cerca de 1/3 de um PNG. Com Python e Pillow:

```bash
mkdir -p img/frames
python - <<'PY'
from PIL import Image
import glob, os
os.makedirs('img/frames', exist_ok=True)
for caminho in sorted(glob.glob('renders/frame-*.png')):
    nome = os.path.basename(caminho).replace('.png', '.webp')
    im = Image.open(caminho)            # mantém o canal alpha
    im.save('img/frames/' + nome, 'WEBP', quality=80, method=6)
    print(nome)
PY
```

### 4. Conferir

Abra `index.html` (com servidor) — o selo do hero deve mostrar
**`SEQ 36F`** e uma barra de pré-carregamento aparece antes da animação
liberar. Se algo falhar, force com `index.html?hero=frames` e veja o console.

**Mudou a quantidade de frames?** Ajuste `totalFrames` no topo de
`js/hero.js` (é a única linha a mexer). Se menos de 10 frames carregarem, o
hero cai sozinho no parallax em vez de mostrar uma animação esburacada.

---

## Como publicar no GitHub Pages

### 1. Criar o repositório e subir os arquivos

```bash
cd site
git init                    # se ainda não for um repositório
git add .
git commit -m "Site do projeto Black Widow"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/black-widow.git
git push -u origin main
```

### 2. Ligar o Pages

No GitHub: **Settings → Pages → Build and deployment**

- **Source:** `Deploy from a branch`
- **Branch:** `main` e pasta `/ (root)`
- **Save**

Em um ou dois minutos o site fica em:
`https://SEU-USUARIO.github.io/black-widow/`

> Se o `index.html` **não** estiver na raiz do repositório (por exemplo, se
> você subir a pasta `robotica/black-widow/site`), escolha a pasta `/docs` e
> mova o site para lá, ou publique só o conteúdo de `site/` na raiz.

### 3. Ajustar as URLs de compartilhamento (opcional, mas recomendado)

Nos três arquivos HTML, troque a `og:image` relativa pela URL completa, para
o preview de link funcionar no WhatsApp e no LinkedIn:

```html
<meta property="og:image" content="https://SEU-USUARIO.github.io/black-widow/img/og-image.jpg">
<meta property="og:url"   content="https://SEU-USUARIO.github.io/black-widow/">
```

### 4. Conferir depois de publicar

- [ ] As três páginas abrem e a navegação marca a página ativa
- [ ] O robô gira ao rolar a home (selo `3D R3`)
- [ ] O preview da planilha aparece (no Pages funciona: é HTTPS, não `file://`)
- [ ] O download da planilha baixa o `.xlsx`
- [ ] O vídeo toca
- [ ] Testar no celular

> **Nomes de arquivo importam no Pages.** O servidor do GitHub é Linux e
> diferencia maiúsculas de minúsculas: `Foto.JPG` e `foto.jpg` são arquivos
> diferentes. Se uma imagem funciona no Windows e "quebra" no Pages, é quase
> sempre isso.

---

## Decisões de projeto

**Três páginas em vez de página única com âncoras.** A home carrega o hero
3D e a página de orçamento carrega o SheetJS (~900 KB) — juntar tudo faria
todo visitante baixar as duas coisas para ler qualquer seção. Separado, cada
assunto tem URL própria para citar no relatório, e o hero fica livre para
usar o topo da página como trilho de rotação, sem disputar o scroll com
âncoras.

**Scripts clássicos, não módulos ES.** `<script type="module">` é bloqueado
por CORS em `file://`, e um requisito do projeto é abrir com duplo clique.
Os scripts compartilham o namespace `window.BW`. A exceção é o modelo 3D, que
é módulo ES — e por isso mesmo só entra em ação quando há servidor.

**A referência em `referencia-prototipo-rotativo/`** é o material original do
visualizador 360° (HTML próprio, screenshots e o `r3-model.js`). Fica no
repositório como documentação; o site usa apenas a cópia do modelo em
`js/r3-model.js`. Pode apagar a pasta sem afetar o site.

**Cores e contraste.** A paleta está toda em variáveis CSS no topo de
`css/estilo.css`. Os contrastes foram conferidos pela fórmula da WCAG 2.1:
o cinza secundário `#8A8A99` rende 5,88:1 sobre o fundo (passa AA). O
vermelho da marca `#C8102E` rende só 3,40:1 — por isso é usado em bordas,
preenchimentos e títulos grandes, **nunca** em texto pequeno; para texto há
`--acento-texto` (`#FF4D64`, 6,19:1).

**Status por cor + ícone + texto.** Nas etapas, o estado nunca depende só da
cor: há sempre um ícone e um rótulo escrito, para quem tem daltonismo.

**Como o scroll é lido.** Os eventos de scroll apenas marcam "precisa
redesenhar"; o desenho acontece em `requestAnimationFrame`. Desenhar dentro
do evento travaria a página, porque ele dispara dezenas de vezes por quadro.
As animações de entrada usam `IntersectionObserver`, não scroll.
