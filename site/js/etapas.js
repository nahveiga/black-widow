/* =========================================================================
   PÁGINA ETAPAS - renderização da linha do tempo e do progresso
   -------------------------------------------------------------------------
   Nada aqui é escrito à mão: a timeline, a porcentagem e os contadores saem
   todos do array window.BW.etapas (js/dados-etapas.js). Para atualizar o
   projeto, edite SOMENTE aquele arquivo.

   A entrada dos itens é animada com IntersectionObserver - não com evento
   de scroll. O observer avisa o navegador uma única vez por elemento,
   enquanto um listener de scroll rodaria a cada pixel rolado.
   ========================================================================= */

(function () {
  'use strict';

  var etapas = (window.BW && window.BW.etapas) || [];
  var statusInfo = (window.BW && window.BW.statusInfo) || {};

  var lista = document.querySelector('[data-timeline]');
  if (!lista || !etapas.length) { return; }

  // ---------------------- 1. MONTAGEM DA LINHA DO TEMPO -------------------
  /* Usamos um DocumentFragment para montar tudo fora da árvore visível e
     inserir de uma vez: um reflow em vez de 15. */
  var fragmento = document.createDocumentFragment();

  etapas.forEach(function (etapa, indice) {
    var info = statusInfo[etapa.status] || statusInfo.pendente;
    var numero = String(indice + 1).padStart(2, '0');

    var item = document.createElement('li');
    item.className = 'etapa ' + info.classe;
    item.setAttribute('data-etapa', '');

    // O marcador é decorativo: o status já vem escrito em texto no rótulo,
    // então o ícone fica escondido do leitor de tela para não duplicar.
    var marcador = document.createElement('span');
    marcador.className = 'etapa-marcador';
    marcador.setAttribute('aria-hidden', 'true');
    marcador.textContent = info.icone;

    var corpo = document.createElement('div');
    corpo.className = 'etapa-corpo';

    var cabecalho = document.createElement('div');
    cabecalho.className = 'etapa-cabecalho';

    var num = document.createElement('span');
    num.className = 'etapa-numero';
    num.textContent = 'ETAPA ' + numero;

    var titulo = document.createElement('h3');
    titulo.className = 'etapa-titulo';
    titulo.textContent = etapa.titulo;

    var status = document.createElement('span');
    status.className = 'etapa-status';
    status.textContent = info.rotulo;

    cabecalho.appendChild(num);
    cabecalho.appendChild(titulo);
    cabecalho.appendChild(status);
    corpo.appendChild(cabecalho);

    if (etapa.descricao) {
      var descricao = document.createElement('p');
      descricao.className = 'etapa-descricao';
      descricao.textContent = etapa.descricao;
      corpo.appendChild(descricao);
    }

    item.appendChild(marcador);
    item.appendChild(corpo);
    fragmento.appendChild(item);
  });

  lista.appendChild(fragmento);

  // -------------------------- 2. CÁLCULO DO PROGRESSO ---------------------
  function contar(status) {
    return etapas.filter(function (e) { return e.status === status; }).length;
  }

  var total = etapas.length;
  var nConcluido = contar('concluido');
  var nAndamento = contar('andamento');
  var nPendente = contar('pendente');

  /* Porcentagem: etapa concluída vale 1, em andamento vale 0,5.
     Contar "em andamento" como meia etapa reflete melhor o estado real do
     que ignorá-la por completo. Arredondamos para inteiro na exibição. */
  var pontos = nConcluido + (nAndamento * 0.5);
  var pct = Math.round((pontos / total) * 100);

  var elValor = document.querySelector('[data-progresso-valor]');
  var elBarra = document.querySelector('[data-progresso-barra]');
  var elTrilha = document.querySelector('[data-progresso-trilha]');

  if (elValor) { elValor.textContent = String(pct); }

  if (elBarra) {
    /* Um tick antes de aplicar a largura: o navegador precisa registrar o
       estado inicial (0%) para que a transição do CSS realmente aconteça. */
    requestAnimationFrame(function () {
      elBarra.style.width = pct + '%';
    });
  }

  // Progresso também exposto como role="progressbar" para leitor de tela.
  if (elTrilha) {
    elTrilha.setAttribute('role', 'progressbar');
    elTrilha.setAttribute('aria-valuemin', '0');
    elTrilha.setAttribute('aria-valuemax', '100');
    elTrilha.setAttribute('aria-valuenow', String(pct));
    elTrilha.setAttribute('aria-valuetext', pct + '% do projeto concluído');
  }

  function preencher(seletor, valor) {
    var el = document.querySelector(seletor);
    if (el) { el.textContent = String(valor); }
  }
  preencher('[data-conta-concluido]', nConcluido);
  preencher('[data-conta-andamento]', nAndamento);
  preencher('[data-conta-pendente]', nPendente);
  preencher('[data-conta-total]', total);

  // ------------------- 3. ANIMAÇÃO DE ENTRADA (OBSERVER) ------------------
  var itens = lista.querySelectorAll('[data-etapa]');

  // Sem suporte ao observer (ou com movimento reduzido), mostramos tudo
  // de uma vez: a informação nunca depende da animação para aparecer.
  var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!('IntersectionObserver' in window) || reduzido) {
    for (var i = 0; i < itens.length; i++) {
      itens[i].classList.add('visivel');
    }
    return;
  }

  var observer = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (entrada) {
      if (!entrada.isIntersecting) { return; }

      /* Escada de 60 ms entre os itens visíveis no mesmo lote: a timeline
         "desce" em cascata em vez de aparecer tudo junto. */
      var pos = Array.prototype.indexOf.call(itens, entrada.target);
      entrada.target.style.transitionDelay = (pos % 6) * 60 + 'ms';
      entrada.target.classList.add('visivel');

      // Cada item só precisa animar uma vez.
      observer.unobserve(entrada.target);
    });
  }, {
    // Dispara um pouco antes de entrar na tela, para o item já chegar
    // animado em vez de animar depois de visível.
    rootMargin: '0px 0px -12% 0px',
    threshold: 0.1
  });

  for (var j = 0; j < itens.length; j++) {
    observer.observe(itens[j]);
  }
})();
