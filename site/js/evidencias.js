/* =========================================================================
   SEÇÃO EVIDÊNCIAS - renderização a partir de js/dados-evidencias.js
   -------------------------------------------------------------------------
   Monta uma lista de registros do projeto. Cada item vira uma linha com a
   mídia à esquerda e a descrição à direita (empilhado no celular).

   Três formas de card:
     foto disponível   -> <picture> dentro de um <button> que abre o lightbox
     vídeo disponível  -> player HTML5 nativo, com poster e sem autoplay
     pendente          -> moldura tracejada, sem mídia, com a tarefa sugerida

   Os cards pendentes existem de propósito: mostram o que ainda falta
   registrar em vez de esconder a lacuna.
   ========================================================================= */

(function () {
  'use strict';

  var evidencias = (window.BW && window.BW.evidencias) || [];
  var INFO = (window.BW && window.BW.evidenciaInfo) || { tipo: {}, status: {} };

  var lista = document.querySelector('[data-evidencias]');
  if (!lista || !evidencias.length) { return; }

  // ---------------------------- AUXILIARES --------------------------------
  function criar(tag, classe, texto) {
    var el = document.createElement(tag);
    if (classe) { el.className = classe; }
    if (texto !== undefined) { el.textContent = texto; }
    return el;
  }

  /* Selo com ícone + rótulo. O ícone é marcado como decorativo para o leitor
     de tela não ler "marca de seleção" antes de cada palavra - o rótulo ao
     lado já diz tudo. */
  function selo(classe, icone, rotulo) {
    var s = criar('span', classe);
    if (icone) {
      var i = criar('span', 'evidencia-icone', icone);
      i.setAttribute('aria-hidden', 'true');
      s.appendChild(i);
    }
    s.appendChild(document.createTextNode(rotulo));
    return s;
  }

  /* <picture> com WebP e JPG de reserva. width/height reservam o espaço
     antes do download e evitam o "pulo" do texto quando a imagem chega. */
  function montarPicture(item, preguicosa) {
    var picture = document.createElement('picture');

    if (item.webp) {
      var source = document.createElement('source');
      source.srcset = item.webp;
      source.type = 'image/webp';
      picture.appendChild(source);
    }

    var img = document.createElement('img');
    img.src = item.arquivo;
    img.alt = item.alt || '';
    if (item.largura) { img.width = item.largura; }
    if (item.altura) { img.height = item.altura; }
    if (preguicosa) {
      img.loading = 'lazy';
      img.decoding = 'async';
    }
    picture.appendChild(img);

    return picture;
  }

  // ------------------------------- MÍDIA ----------------------------------
  function montarMidia(item, indice) {
    var caixa = criar('div', 'evidencia-midia');

    // --- Pendente: moldura tracejada no lugar da mídia ---
    if (item.status !== 'ok') {
      var vazio = criar('div', 'evidencia-vazia');
      var marca = criar('span', 'evidencia-vazia-icone', '□'); // □
      marca.setAttribute('aria-hidden', 'true');
      vazio.appendChild(marca);
      vazio.appendChild(criar('span', 'evidencia-vazia-texto', 'Registro pendente'));
      caixa.appendChild(vazio);
      return caixa;
    }

    // --- Vídeo: player nativo, sem autoplay e sem baixar o arquivo inteiro ---
    if (item.tipo === 'video') {
      var moldura = criar('div', 'evidencia-video');

      var video = document.createElement('video');
      video.controls = true;
      // preload="metadata" baixa só o cabeçalho; o vídeo inteiro só desce
      // se a pessoa der play.
      video.preload = 'metadata';
      video.playsInline = true;
      if (item.poster) { video.poster = item.poster; }
      if (item.largura) { video.width = item.largura; }
      if (item.altura) { video.height = item.altura; }

      var fonte = document.createElement('source');
      fonte.src = item.arquivo;
      fonte.type = 'video/mp4';
      video.appendChild(fonte);

      // Texto de reserva para navegador sem suporte a vídeo HTML5
      var reserva = criar('p');
      reserva.appendChild(document.createTextNode('Seu navegador não reproduz vídeo HTML5. '));
      var link = criar('a', null, 'Baixe o vídeo do funcionamento');
      link.href = item.arquivo;
      reserva.appendChild(link);
      reserva.appendChild(document.createTextNode('.'));
      video.appendChild(reserva);

      moldura.appendChild(video);
      caixa.appendChild(moldura);
      return caixa;
    }

    /* --- Foto: <button> e não <div> com onclick. Botão já é focável,
       acionável por Enter/Espaço e anunciado como botão pelo leitor de tela.
       Os data-* são lidos pelo lightbox em js/comum.js. --- */
    var botao = criar('button', 'evidencia-botao');
    botao.type = 'button';
    botao.setAttribute('data-lightbox-abrir', '');
    botao.setAttribute('data-src', item.arquivo);
    botao.setAttribute('data-alt', item.alt || '');
    botao.setAttribute('data-legenda', item.titulo);
    // A primeira evidência costuma estar perto do topo: só as seguintes
    // ganham loading="lazy".
    botao.appendChild(montarPicture(item, indice > 0));

    caixa.appendChild(botao);
    return caixa;
  }

  // ------------------------------ MONTAGEM --------------------------------
  var fragmento = document.createDocumentFragment();

  evidencias.forEach(function (item, indice) {
    var tipoInfo = INFO.tipo[item.tipo] || { rotulo: item.tipo, icone: '' };
    var statusInfo = INFO.status[item.status] || INFO.status.pendente;
    var disponivel = item.status === 'ok';

    var li = criar('li', 'evidencia' + (disponivel ? '' : ' evidencia--pendente'));
    li.setAttribute('data-evidencia', '');

    li.appendChild(montarMidia(item, indice));

    var info = criar('div', 'evidencia-info');

    // Linha de selos: tipo · etapa · status
    var meta = criar('div', 'evidencia-meta');
    meta.appendChild(selo('evidencia-selo', tipoInfo.icone, tipoInfo.rotulo));
    meta.appendChild(selo('evidencia-selo', '', item.etapa));
    meta.appendChild(selo(
      'evidencia-selo evidencia-selo--' + (disponivel ? 'ok' : 'pendente'),
      statusInfo.icone,
      statusInfo.rotulo
    ));
    info.appendChild(meta);

    info.appendChild(criar('h3', 'evidencia-titulo', item.titulo));

    /* Nos itens pendentes o texto é o que AINDA SERÁ registrado: o rótulo
       "Tarefa sugerida" evita que se leia como algo já feito. */
    if (!disponivel) {
      info.appendChild(criar('p', 'evidencia-rotulo-tarefa', 'Tarefa sugerida'));
    }

    info.appendChild(criar('p', 'evidencia-tarefa', item.tarefa));

    if (item.detalhe) {
      info.appendChild(criar('p', 'evidencia-detalhe', item.detalhe));
    }

    li.appendChild(info);
    fragmento.appendChild(li);
  });

  // Um único append: um reflow em vez de um por evidência.
  lista.appendChild(fragmento);

  // --------------------------- CONTADOR NO TOPO ---------------------------
  var registradas = evidencias.filter(function (e) { return e.status === 'ok'; }).length;

  function preencher(seletor, valor) {
    var el = document.querySelector(seletor);
    if (el) { el.textContent = String(valor); }
  }
  preencher('[data-evidencias-ok]', registradas);
  preencher('[data-evidencias-total]', evidencias.length);

  // ------------------- ANIMAÇÃO DE ENTRADA (OBSERVER) ---------------------
  var itens = lista.querySelectorAll('[data-evidencia]');
  var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!('IntersectionObserver' in window) || reduzido) {
    for (var i = 0; i < itens.length; i++) { itens[i].classList.add('visivel'); }
    return;
  }

  var observer = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (entrada) {
      if (!entrada.isIntersecting) { return; }
      entrada.target.classList.add('visivel');
      observer.unobserve(entrada.target);   // anima uma vez só
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });

  for (var j = 0; j < itens.length; j++) { observer.observe(itens[j]); }
})();
