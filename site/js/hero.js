/* =========================================================================
   HERO COM ROTAÇÃO CONTROLADA PELO SCROLL
   -------------------------------------------------------------------------
   O hero funciona em camadas, escolhidas automaticamente conforme os
   arquivos que existirem na pasta. Nenhuma imagem é gerada por código:
   o script apenas TESTA se o asset existe e cai para a camada seguinte.

     MODO 1 "frames"    -> img/frames/frame-001.webp ... frame-036.webp
                           Sequência desenhada em <canvas>, pré-carregada,
                           com o índice do frame mapeado pelo scroll.
     MODO 2 "3d"        -> models/robo.glb
                           three.js + GLTFLoader (build UMD clássico),
                           rotação no eixo Y pelo scroll.
     MODO 2b "modelo"   -> js/r3-model.js  (É O QUE RODA HOJE)
                           Modelo do robô montado por código (geometria
                           procedural), carregado como módulo ES. Mesma
                           rotação por scroll + inclinação pelo mouse.
     MODO 3 "fallback"  -> img/prototipo.jpg
                           Parallax + escala leve + inclinação 3D sutil.
                           NÃO gira a imagem 2D: rotacionar uma foto plana
                           fica visivelmente falso.

   Os modos 2 e 2b dependem de servidor: o protocolo file:// bloqueia fetch
   e módulos ES. Abrindo por duplo clique, o hero cai no parallax sozinho.

   ACESSIBILIDADE E PERFORMANCE VÊM ANTES DO EFEITO:
   com prefers-reduced-motion, ou em tela pequena com aparelho fraco, ou com
   economia de dados ligada, o hero exibe a imagem estática e nenhum efeito.

   COMO FORÇAR UM MODO (útil para testar):
     index.html?hero=frames   ?hero=3d       ?hero=modelo
                ?hero=fallback ?hero=estatico
   ========================================================================= */

(function () {
  'use strict';

  // ----------------------------- CONFIGURAÇÃO -----------------------------
  var CFG = {
    // Quantidade de frames da sequência do MODO 1. Se você gerar outro
    // número de frames, mude AQUI (e só aqui).
    totalFrames: 36,

    // Monta o caminho do frame N com zero-padding de 3 dígitos.
    caminhoFrame: function (n) {
      return 'img/frames/frame-' + String(n).padStart(3, '0') + '.webp';
    },

    caminhoModelo: 'models/robo.glb',

    // Modelo procedural: monta o robô por código, sem arquivo de modelo.
    // Detectamos pela existência do arquivo; o import em si usa o nome
    // "r3-model", declarado no import map do index.html.
    caminhoModeloProcedural: 'js/r3-model.js',

    // Se muitos frames falharem no carregamento, não vale animar: cai
    // para o fallback em vez de mostrar uma sequência esburacada.
    minFramesAceitavel: 10,

    // Inclinação máxima do mouse, em graus. Limite baixo de propósito:
    // inclinação exagerada embaralha a leitura da foto.
    inclinacaoMax: 6,

    // Suavização da inclinação (0 a 1). Quanto menor, mais "pesado".
    suavidade: 0.08,

    // three.js r137 (build UMD clássico, expõe a global THREE). Usamos essa
    // versão porque o GLTFLoader dela é script clássico: funciona sem
    // import map e sem build. Versões novas só entregam módulos ES.
    cdnThree: 'https://cdn.jsdelivr.net/npm/three@0.137.5/build/three.min.js',
    cdnGltf: 'https://cdn.jsdelivr.net/npm/three@0.137.5/examples/js/loaders/GLTFLoader.js'
  };

  // ------------------------------ ELEMENTOS -------------------------------
  var hero = document.querySelector('[data-hero]');
  if (!hero) { return; }

  var midia      = hero.querySelector('[data-hero-midia]');
  var canvas     = hero.querySelector('[data-hero-canvas]');
  var imgEstatica= hero.querySelector('[data-hero-img]');
  var boxCarrega = hero.querySelector('[data-hero-carregando]');
  var barra      = hero.querySelector('[data-hero-barra]');
  var txtCarrega = hero.querySelector('[data-hero-barra-texto]');
  var selo       = hero.querySelector('[data-hero-selo]');
  var dicaScroll = hero.querySelector('[data-hero-scroll]');

  // ------------------------------ UTILITÁRIOS -----------------------------
  function limitar(v, min, max) { return v < min ? min : (v > max ? max : v); }
  function interpolar(a, b, t) { return a + (b - a) * t; }

  function param(nome) {
    try {
      return new URLSearchParams(window.location.search).get(nome);
    } catch (e) {
      return null;
    }
  }

  var mqReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Decide se devemos abrir mão do efeito.
     - preferência declarada do sistema  -> sempre respeitada
     - economia de dados ligada          -> não baixa 36 imagens
     - tela pequena + aparelho fraco     -> evita travar celular simples */
  function deveFicarEstatico() {
    if (mqReduzido.matches) { return true; }

    var con = navigator.connection || navigator.webkitConnection;
    if (con && con.saveData === true) { return true; }

    var telaPequena = window.innerWidth < 640;
    var poucosNucleos = typeof navigator.hardwareConcurrency === 'number' &&
                        navigator.hardwareConcurrency <= 4;
    var poucaMemoria = typeof navigator.deviceMemory === 'number' &&
                       navigator.deviceMemory <= 4;
    if (telaPequena && (poucosNucleos || poucaMemoria)) { return true; }

    return false;
  }

  /* Testa a existência de uma imagem sem usar fetch.
     Importante: fetch em file:// é bloqueado por CORS, mas <img> não é -
     por isso a detecção dos frames funciona até abrindo por duplo clique. */
  function imagemExiste(url) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(true); };
      img.onerror = function () { resolve(false); };
      img.src = url;
    });
  }

  /* Testa a existência do modelo .glb. Aqui precisamos de fetch, então em
     file:// a checagem é impossível: retornamos false e seguimos para o
     fallback (o próprio three.js também não conseguiria ler o arquivo). */
  function arquivoExiste(url) {
    if (window.location.protocol === 'file:') { return Promise.resolve(false); }
    return fetch(url, { method: 'HEAD' })
      .then(function (r) { return r.ok; })
      .catch(function () { return false; });
  }

  function carregarScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Falha ao carregar ' + src)); };
      document.head.appendChild(s);
    });
  }

  function mostrarSelo(texto) {
    if (selo) { selo.innerHTML = 'HERO <b>' + texto + '</b>'; }
  }

  // -------------------------------- ESTADO --------------------------------
  var modo = 'estatico';
  var frames = [];
  var ctx = null;
  var tresD = null;          // { renderer, scene, camera, objeto }
  var alvo = { x: 0, y: 0 }; // inclinação desejada (vem do mouse)
  var atual = { x: 0, y: 0 };// inclinação aplicada (persegue o alvo)
  var sujo = true;           // há algo novo para desenhar?
  var rodando = false;
  var heroVisivel = true;

  /* Progresso do scroll DENTRO do hero, de 0 a 1.
     Nos modos frames/3D o hero é mais alto que a tela e a arte fica sticky:
     a distância rolada dentro dele é o "controle" da rotação. */
  function progressoScroll() {
    var r = hero.getBoundingClientRect();
    var curso = hero.offsetHeight - window.innerHeight;
    if (curso <= 0) { return 0; }
    return limitar(-r.top / curso, 0, 1);
  }

  // --------------------------- LEITURA DE EVENTOS -------------------------
  /* Regra de ouro: os listeners NÃO desenham. Eles só marcam "sujo" e
     acordam o requestAnimationFrame. O evento de scroll dispara dezenas de
     vezes por frame; desenhar direto nele trava a página. */
  window.addEventListener('scroll', function () {
    sujo = true;
    acordar();
  }, { passive: true });

  window.addEventListener('resize', function () {
    redimensionar();
    sujo = true;
    acordar();
  }, { passive: true });

  /* Inclinação pelo mouse.
     O listener é registrado SEMPRE e o tipo de ponteiro é checado a cada
     evento, em vez de consultar matchMedia uma única vez no carregamento.
     Dois motivos:
       1. a media query pode ainda não refletir o ponteiro real no instante
          em que o script roda, e aí a inclinação nunca mais ligaria;
       2. em aparelho híbrido (notebook com touch) isto dá o comportamento
          certo por evento: o mouse inclina, o toque não. */
  window.addEventListener('pointermove', function (ev) {
    if (ev.pointerType === 'touch') { return; }

    var cx = window.innerWidth / 2;
    var cy = window.innerHeight / 2;
    // Normaliza para -1..1 e inverte Y (mouse para cima = inclina para trás)
    alvo.y = limitar((ev.clientX - cx) / cx, -1, 1);
    alvo.x = limitar(-(ev.clientY - cy) / cy, -1, 1);
    sujo = true;
    acordar();
  }, { passive: true });

  /* Pausa o loop quando o hero sai da tela: não faz sentido gastar bateria
     desenhando algo que ninguém está vendo. */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entradas) {
      heroVisivel = entradas[0].isIntersecting;
      if (heroVisivel) { sujo = true; acordar(); }
    }, { rootMargin: '120px' }).observe(hero);
  }

  // Se a pessoa mudar a preferência de movimento com o site aberto,
  // desligamos o efeito na hora, sem precisar recarregar.
  function ouvirPreferencia() {
    var aoMudar = function () {
      if (mqReduzido.matches && modo !== 'estatico') { virarEstatico(); }
    };
    if (typeof mqReduzido.addEventListener === 'function') {
      mqReduzido.addEventListener('change', aoMudar);
    } else if (typeof mqReduzido.addListener === 'function') {
      mqReduzido.addListener(aoMudar); // Safari antigo
    }
  }

  // ------------------------------ LOOP rAF --------------------------------
  function acordar() {
    if (!rodando && heroVisivel && modo !== 'estatico') {
      rodando = true;
      requestAnimationFrame(quadro);
    }
  }

  function quadro() {
    // Persegue a inclinação alvo. Enquanto a diferença for perceptível,
    // continuamos pedindo quadros (é o que dá a sensação de peso).
    var antesX = atual.x, antesY = atual.y;
    atual.x = interpolar(atual.x, alvo.x, CFG.suavidade);
    atual.y = interpolar(atual.y, alvo.y, CFG.suavidade);
    var assentando = Math.abs(atual.x - antesX) > 0.0005 ||
                     Math.abs(atual.y - antesY) > 0.0005;

    if (sujo || assentando) {
      if (modo === 'frames')   { renderFrames(); }
      if (modo === '3d')       { render3D(); }
      if (modo === 'fallback') { renderFallback(); }
      sujo = false;
    }

    if (heroVisivel && (assentando || sujo)) {
      requestAnimationFrame(quadro);
    } else {
      rodando = false;
    }
  }

  // --------------------------- MODO 1: FRAMES -----------------------------
  function redimensionarCanvas() {
    if (!canvas) { return; }
    // Limita o DPR em 2: acima disso o custo de pintar não se paga.
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cx = canvas.getBoundingClientRect();
    if (!cx.width || !cx.height) { return; }
    canvas.width  = Math.round(cx.width * dpr);
    canvas.height = Math.round(cx.height * dpr);
  }

  function renderFrames() {
    if (!ctx || !frames.length) { return; }

    var p = progressoScroll();
    var i = Math.round(p * (frames.length - 1));
    var img = frames[limitar(i, 0, frames.length - 1)];
    if (!img) { return; }

    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Equivalente ao object-fit: contain, feito à mão no canvas.
    var esc = Math.min(W / img.naturalWidth, H / img.naturalHeight);
    var dw = img.naturalWidth * esc;
    var dh = img.naturalHeight * esc;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);

    aplicarInclinacao(canvas);
  }

  /* Pré-carrega TODOS os frames antes de liberar a animação. Sem isso, um
     scroll rápido pede um frame que ainda não chegou e a tela pisca. */
  function precarregarFrames(total, aoProgredir) {
    return new Promise(function (resolve) {
      var prontos = 0;
      var lista = new Array(total);

      function contabilizar() {
        prontos++;
        aoProgredir(prontos / total);
        if (prontos === total) {
          // Remove os buracos (frames que falharam) preservando a ordem.
          resolve(lista.filter(Boolean));
        }
      }

      for (var n = 1; n <= total; n++) {
        (function (indice) {
          var img = new Image();
          img.onload = function () { lista[indice] = img; contabilizar(); };
          img.onerror = function () { contabilizar(); };
          img.src = CFG.caminhoFrame(indice + 1);
        })(n - 1);
      }
    });
  }

  function iniciarFrames() {
    ativarTrilhoDeScroll();
    if (boxCarrega) { boxCarrega.hidden = false; }

    return precarregarFrames(CFG.totalFrames, function (frac) {
      var pct = Math.round(frac * 100);
      if (barra) { barra.style.width = pct + '%'; }
      if (txtCarrega) { txtCarrega.textContent = 'Carregando sequência ' + pct + '%'; }
    }).then(function (carregados) {
      if (boxCarrega) { boxCarrega.hidden = true; }

      if (carregados.length < CFG.minFramesAceitavel) {
        // Poucos frames chegaram: melhor o fallback do que uma animação suja.
        hero.classList.remove('hero--scrollavel');
        return iniciarFallback();
      }

      frames = carregados;
      ctx = canvas.getContext('2d');
      if (imgEstatica) { imgEstatica.hidden = true; }
      canvas.hidden = false;
      redimensionarCanvas();

      modo = 'frames';
      mostrarSelo('SEQ ' + frames.length + 'F');
      sujo = true;
      acordar();
    });
  }

  // ----------------------------- MODO 2: 3D -------------------------------
  function iniciar3D() {
    ativarTrilhoDeScroll();
    if (boxCarrega) { boxCarrega.hidden = false; }
    if (txtCarrega) { txtCarrega.textContent = 'Carregando modelo 3D'; }
    if (barra) { barra.style.width = '15%'; }

    return carregarScript(CFG.cdnThree)
      .then(function () { return carregarScript(CFG.cdnGltf); })
      .then(function () {
        if (barra) { barra.style.width = '45%'; }
        return new Promise(function (resolve, reject) {
          new THREE.GLTFLoader().load(CFG.caminhoModelo, resolve, function (ev) {
            if (barra && ev && ev.total) {
              var pct = 45 + Math.round((ev.loaded / ev.total) * 50);
              barra.style.width = pct + '%';
            }
          }, reject);
        });
      })
      .then(function (gltf) {
        // O build UMD expõe a global THREE; o modo procedural passa o
        // namespace do módulo. montarCena aceita os dois.
        montarCena(THREE, gltf.scene);
        if (boxCarrega) { boxCarrega.hidden = true; }
        modo = '3d';
        mostrarSelo('3D');
        sujo = true;
        acordar();
      })
      .catch(function (erro) {
        // Qualquer falha (CDN fora, modelo corrompido) cai no fallback.
        console.warn('[hero] modo 3D indisponível:', erro && erro.message);
        if (boxCarrega) { boxCarrega.hidden = true; }
        hero.classList.remove('hero--scrollavel');
        return iniciarFallback();
      });
  }

  /* Monta a cena 3D.
     Recebe "T" (o namespace do three.js) em vez de usar a global THREE:
     o modo .glb carrega o build UMD e passa a global, enquanto o modo
     procedural carrega três como módulo ES e passa o namespace do módulo.
     A API usada aqui é idêntica nos dois casos. */
  function montarCena(T, objeto) {
    /* Troca a imagem pelo canvas ANTES de criar o renderer: um canvas com
       atributo hidden não tem caixa de layout, mediria 0x0 e o renderer
       nasceria com tamanho zero (tela preta). */
    if (imgEstatica) { imgEstatica.hidden = true; }
    canvas.hidden = false;
    // Glow menor no 3D: o robô flutua no centro e não preenche a caixa como
    // a prancha, então o halo de 120% viraria uma nuvem vermelha enorme.
    hero.classList.add('hero--3d');
    canvas.removeAttribute('aria-hidden');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label',
      'Modelo tridimensional do robô Black Widow, que gira conforme a rolagem da página.');

    var cena = new T.Scene();

    var camera = new T.PerspectiveCamera(34, 1, 0.1, 100);

    var renderer = new T.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true          // fundo transparente: o glow do CSS aparece atrás
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearAlpha(0);

    /* Tone mapping filmico: o robô é de alumínio anodizado escuro e, sem
       isto, o metal estoura em branco no ponto da key light e o resto
       vira um borrão preto. */
    if (T.ACESFilmicToneMapping) {
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
    }

    /* Iluminação escura com key light avermelhada, coerente com a
       identidade visual. Quatro fontes, cada uma com um papel:
         hemisfério -> leitura mínima do volume (sem ele o robô é silhueta)
         key vermelha -> a cor da marca, alta e à esquerda
         rim fria -> separa a silhueta do fundo escuro
         fill frontal -> abre as sombras da frente sem lavar a imagem */
    cena.add(new T.HemisphereLight(0xC9D4E4, 0x0A0A0F, 0.75));

    var key = new T.DirectionalLight(0xC8102E, 3.4);
    key.position.set(-2.2, 2.6, 1.6);
    cena.add(key);

    var rim = new T.DirectionalLight(0x9FB4FF, 1.5);
    rim.position.set(2.6, 1.4, -2.4);
    cena.add(rim);

    var fill = new T.DirectionalLight(0xFFFFFF, 0.75);
    fill.position.set(0.6, -0.8, 2.4);
    cena.add(fill);

    /* Normaliza escala e centro pela bounding box: o modelo procedural vem
       em metros (~0,44 m) e um .glb qualquer pode vir em qualquer tamanho.
       Assim os dois enquadram igual, sem número mágico por modelo. */
    var caixa = new T.Box3().setFromObject(objeto);
    var tam = caixa.getSize(new T.Vector3());
    var centro = caixa.getCenter(new T.Vector3());
    var maior = Math.max(tam.x, tam.y, tam.z) || 1;
    var escala = 1.6 / maior;

    objeto.scale.setScalar(escala);
    // Recentraliza no próprio eixo: o robô precisa girar em torno de si,
    // não descrever um círculo em volta de um centro deslocado.
    objeto.position.set(
      -centro.x * escala,
      -centro.y * escala,
      -centro.z * escala
    );

    var pivo = new T.Group();
    pivo.add(objeto);
    cena.add(pivo);

    /* Enquadramento.
       O robô é uma cunha comprida e baixa: usar a esfera envolvente para
       calcular a distância superestima muito a altura ocupada e deixa o
       modelo minúsculo no meio da tela. Então calculamos separadamente:
         halfW -> maior meia-largura que ele alcança girando em torno de Y
                  (a diagonal do retângulo x-z, que é o pior caso do giro)
         halfH -> meia-altura, que não muda com o giro
       e tomamos a distância que satisfaz as duas, cada uma no seu eixo. */
    var halfW = Math.sqrt(
      Math.pow(tam.x * escala / 2, 2) + Math.pow(tam.z * escala / 2, 2)
    );
    var halfH = tam.y * escala / 2;

    var tanV = Math.tan((camera.fov * Math.PI / 180) / 2);
    var aspecto = larguraCanvas() / Math.max(alturaCanvas(), 1);
    var distV = halfH / tanV;
    var distH = halfW / (tanV * Math.max(aspecto, 0.1));
    var dist = Math.max(distV, distH) * 1.12;   // 12% de folga nas beiradas

    // Câmera levemente acima, olhando para o centro do robô: mostra a rampa
    // e o tambor ao mesmo tempo, em vez de uma vista de perfil achatada.
    camera.position.set(0, dist * 0.24, dist);
    camera.lookAt(0, 0, 0);

    tresD = {
      T: T, renderer: renderer, cena: cena, camera: camera, pivo: pivo,
      halfW: halfW, halfH: halfH
    };

    /* Environment map: os materiais do robô são metais (metalness ~0.7) e
       metal sem nada para refletir renderiza quase preto. A RoomEnvironment
       dá um entorno neutro para as superfícies espelharem, e a intensidade
       baixa mantém a cena escura, como pede a identidade visual. */
    aplicarAmbiente(T, cena, renderer);

    redimensionar3D();
  }

  /* Havia um hash na URL quando a página abriu? Guardamos no carregamento,
     antes de qualquer coisa mudar de tamanho. */
  var ancoraInicial = window.location.hash;
  var ancoraCorrigida = false;

  /* Marca se a pessoa já rolou por conta própria. Só contam gestos reais
     (roda, toque, teclado) - não o scroll que o próprio script provoca,
     que é justamente o que queremos distinguir. Depois de um gesto,
     paramos de corrigir a âncora: mandar a página para outro lugar no meio
     da leitura é pior do que a âncora imprecisa. */
  var usuarioRolou = false;
  ['wheel', 'touchstart', 'keydown'].forEach(function (evento) {
    window.addEventListener(evento, function () { usuarioRolou = true; },
      { passive: true, once: true });
  });

  /* Liga o "trilho" de scroll do hero (os modos com rotação precisam de uma
     área alta para a arte ficar sticky enquanto o robô gira).

     Isso aumenta o hero de 1 para ~2,6 telas e empurra todo o conteúdo para
     baixo. Se a pessoa abriu a página com uma âncora (index.html#video, um
     link compartilhado), o navegador já tinha rolado até o alvo usando a
     altura ANTIGA - e depois do crescimento ela cairia no meio do hero.
     Por isso reposicionamos na âncora depois de mudar a altura. */
  function ativarTrilhoDeScroll() {
    hero.classList.add('hero--scrollavel');

    if (ancoraCorrigida || !ancoraInicial) { return; }
    ancoraCorrigida = true;

    var alvo;
    try {
      alvo = document.querySelector(ancoraInicial);
    } catch (e) {
      return; // hash que não é seletor válido
    }
    if (!alvo) { return; }

    /* Reposiciona na âncora com scroll instantâneo.
       O CSS usa scroll-behavior: smooth, então desligamos o suave por um
       instante: corrigir layout não é navegação, e animado a página desceria
       sozinha na frente de quem está lendo. */
    var reposicionar = function () {
      if (usuarioRolou) { return; }   // não roubamos o controle de quem já rolou

      var raiz = document.documentElement;
      var anterior = raiz.style.scrollBehavior;
      raiz.style.scrollBehavior = 'auto';
      alvo.scrollIntoView({ block: 'start' });
      // setTimeout (e não rAF): em aba oculta o rAF não roda e a
      // preferência de scroll suave nunca voltaria.
      setTimeout(function () { raiz.style.scrollBehavior = anterior; }, 80);
    };

    /* Várias tentativas, de propósito. Na primeira, o documento ainda pode
       estar curto (fontes e imagens pendentes) e o scroll é limitado pela
       altura disponível - a correção "não pega". As tentativas seguintes
       acontecem quando a altura final já está valendo. Reposicionar para o
       mesmo lugar duas vezes não faz efeito nenhum, então repetir é seguro. */
    reposicionar();
    setTimeout(reposicionar, 300);

    if (document.readyState === 'complete') {
      setTimeout(reposicionar, 700);
    } else {
      window.addEventListener('load', function () {
        setTimeout(reposicionar, 120);
      }, { once: true });
    }
  }

  // Dimensões CSS do canvas (o canvas.width é em pixels de dispositivo).
  function larguraCanvas() {
    return canvas.getBoundingClientRect().width || 1;
  }
  function alturaCanvas() {
    return canvas.getBoundingClientRect().height || 1;
  }

  /* Gera o environment map a partir da RoomEnvironment do three.js.
     É carregado em separado e de forma tolerante: se o addon não vier do
     CDN, a cena continua funcionando só com as luzes diretas - fica mais
     escura, mas não quebra. */
  function aplicarAmbiente(T, cena, renderer) {
    import('three/addons/environments/RoomEnvironment.js')
      .then(function (mod) {
        var pmrem = new T.PMREMGenerator(renderer);
        var ambiente = pmrem.fromScene(new mod.RoomEnvironment(), 0.04);
        cena.environment = ambiente.texture;
        // Mantém o conjunto escuro: o ambiente serve para desenhar o metal,
        // não para iluminar a cena inteira.
        if ('environmentIntensity' in cena) {
          cena.environmentIntensity = 0.45;
        }
        pmrem.dispose();
        sujo = true;
        acordar();
      })
      .catch(function (erro) {
        console.warn('[hero] environment map indisponível:', erro && erro.message);
      });
  }

  // -------------------- MODO 2b: MODELO PROCEDURAL ------------------------
  /* Usa js/r3-model.js, que constrói o robô por geometria no próprio código.
     Vantagem sobre o .glb: não há arquivo binário para versionar e o modelo
     é editável. Depende de módulos ES, que o protocolo file:// bloqueia -
     daí a checagem de arquivoExiste() devolver false em file:// e o hero
     cair no parallax quando o site é aberto por duplo clique. */
  function iniciarModeloProcedural() {
    ativarTrilhoDeScroll();
    if (boxCarrega) { boxCarrega.hidden = false; }
    if (txtCarrega) { txtCarrega.textContent = 'Carregando modelo 3D'; }
    if (barra) { barra.style.width = '20%'; }

    /* import() dinâmico funciona dentro de script clássico e resolve pelo
       import map do index.html. Envolvido em Promise.resolve().then() para
       que um erro de sintaxe de import em navegador antigo caia no catch
       em vez de derrubar o script inteiro. */
    return Promise.resolve()
      .then(function () {
        return Promise.all([import('three'), import('r3-model')]);
      })
      .then(function (mods) {
        var T = mods[0];
        var modelo = mods[1];

        if (typeof modelo.buildR3 !== 'function') {
          throw new Error('r3-model.js não exporta buildR3()');
        }

        if (barra) { barra.style.width = '80%'; }

        montarCena(T, modelo.buildR3());

        if (boxCarrega) { boxCarrega.hidden = true; }
        modo = '3d';
        mostrarSelo('3D R3');
        sujo = true;
        acordar();
      })
      .catch(function (erro) {
        console.warn('[hero] modelo procedural indisponível:', erro && erro.message);
        if (boxCarrega) { boxCarrega.hidden = true; }
        hero.classList.remove('hero--scrollavel');
        return iniciarFallback();
      });
  }

  function redimensionar3D() {
    if (!tresD) { return; }
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) { return; }

    tresD.renderer.setSize(r.width, r.height, false);
    tresD.camera.aspect = r.width / r.height;
    tresD.camera.updateProjectionMatrix();

    /* Reenquadra ao mudar de tamanho. Necessário porque a proporção da
       caixa muda entre desktop e celular: com a distância fixa, o robô
       sairia pelas beiradas na tela estreita. */
    var tanV = Math.tan((tresD.camera.fov * Math.PI / 180) / 2);
    var distV = tresD.halfH / tanV;
    var distH = tresD.halfW / (tanV * Math.max(tresD.camera.aspect, 0.1));
    var dist = Math.max(distV, distH) * 1.12;

    tresD.camera.position.set(0, dist * 0.24, dist);
    tresD.camera.lookAt(0, 0, 0);
  }

  function render3D() {
    if (!tresD) { return; }
    var p = progressoScroll();

    // Scroll controla a rotação no eixo Y: uma volta completa no curso.
    tresD.pivo.rotation.y = p * Math.PI * 2;

    // Mouse adiciona inclinação sutil, limitada pelo CFG.inclinacaoMax.
    var lim = CFG.inclinacaoMax * Math.PI / 180;
    tresD.pivo.rotation.x = atual.x * lim;
    tresD.pivo.rotation.z = -atual.y * lim * 0.4;

    tresD.renderer.render(tresD.cena, tresD.camera);
  }

  // -------------------------- MODO 3: FALLBACK ----------------------------
  /* Parallax + escala leve + inclinação 3D no eixo X/Y.
     Deliberadamente NÃO há rotação em torno do eixo vertical: girar uma
     foto 2D não simula um objeto girando, só denuncia o truque. */
  function renderFallback() {
    if (!imgEstatica) { return; }

    var r = hero.getBoundingClientRect();
    // 0 quando o hero está no topo, 1 quando já saiu uma tela inteira.
    var p = limitar(-r.top / Math.max(window.innerHeight, 1), 0, 1);

    var deslocY = p * 56;            // parallax: sobe mais devagar que a página
    var escala = 1 + p * 0.05;       // escala leve
    var lim = CFG.inclinacaoMax;

    imgEstatica.style.transform =
      'perspective(900px) ' +
      'translate3d(0, ' + deslocY.toFixed(2) + 'px, 0) ' +
      'scale(' + escala.toFixed(4) + ') ' +
      'rotateX(' + (atual.x * lim).toFixed(2) + 'deg) ' +
      'rotateY(' + (atual.y * lim).toFixed(2) + 'deg)';
  }

  function aplicarInclinacao(el) {
    var lim = CFG.inclinacaoMax;
    el.style.transform =
      'perspective(900px) ' +
      'rotateX(' + (atual.x * lim).toFixed(2) + 'deg) ' +
      'rotateY(' + (atual.y * lim).toFixed(2) + 'deg)';
  }

  function iniciarFallback() {
    modo = 'fallback';
    if (canvas) { canvas.hidden = true; }
    if (imgEstatica) { imgEstatica.hidden = false; }
    mostrarSelo('PARALLAX');
    sujo = true;
    acordar();
  }

  // --------------------------- MODO ESTÁTICO ------------------------------
  function virarEstatico() {
    modo = 'estatico';
    rodando = false;
    if (canvas) { canvas.hidden = true; }
    if (imgEstatica) {
      imgEstatica.hidden = false;
      imgEstatica.style.transform = ''; // limpa qualquer transform anterior
    }
    if (boxCarrega) { boxCarrega.hidden = true; }
    hero.classList.remove('hero--scrollavel');
    if (dicaScroll) { dicaScroll.hidden = true; }
    mostrarSelo('ESTÁTICO');
  }

  function redimensionar() {
    if (modo === 'frames') { redimensionarCanvas(); }
    if (modo === '3d') { redimensionar3D(); }
  }

  // ------------------------------- ARRANQUE -------------------------------
  function iniciar() {
    ouvirPreferencia();

    var forcado = param('hero');

    if (forcado === 'estatico' || (!forcado && deveFicarEstatico())) {
      virarEstatico();
      return;
    }
    if (forcado === 'fallback') { iniciarFallback(); return; }
    if (forcado === 'frames')   { iniciarFrames(); return; }
    if (forcado === '3d')       { iniciar3D(); return; }
    if (forcado === 'modelo')   { iniciarModeloProcedural(); return; }

    /* Detecção automática, na ordem de preferência dos modos:
         1. sequência de frames  (mais leve e mais previsível)
         2. modelo .glb          (arquivo de modelo, se existir)
         3. modelo procedural    (js/r3-model.js - é o que existe hoje)
         4. parallax             (último recurso, sempre funciona)
       Para os frames basta testar o primeiro: se ele existe, a pasta foi
       preenchida. */
    imagemExiste(CFG.caminhoFrame(1)).then(function (temFrames) {
      if (temFrames) { return iniciarFrames(); }

      return arquivoExiste(CFG.caminhoModelo).then(function (temGlb) {
        if (temGlb) { return iniciar3D(); }

        return arquivoExiste(CFG.caminhoModeloProcedural).then(function (temProc) {
          return temProc ? iniciarModeloProcedural() : iniciarFallback();
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
