/* =========================================================================
   COMPORTAMENTOS COMUNS A TODAS AS PÁGINAS
     - remove a classe .sem-js (progressive enhancement)
     - lightbox da galeria usando <dialog> nativo
     - ano do rodapé
   -------------------------------------------------------------------------
   A indicação de página ativa na navegação NÃO é feita aqui: ela está
   escrita direto no HTML de cada página (aria-current="page"), para
   funcionar mesmo sem JavaScript e para não depender de comparar URLs.
   ========================================================================= */

(function () {
  'use strict';

  /* O <html> começa com class="sem-js". Ao rodar este script, a classe sai
     e as animações de entrada assumem o controle. Assim, se o JS falhar ou
     estiver desativado, o CSS mantém todo o conteúdo visível. */
  document.documentElement.classList.remove('sem-js');

  // ------------------------------- RODAPÉ ---------------------------------
  var anos = document.querySelectorAll('[data-ano]');
  for (var i = 0; i < anos.length; i++) {
    anos[i].textContent = String(new Date().getFullYear());
  }

  // ------------------------------ LIGHTBOX --------------------------------
  var dialogo = document.querySelector('[data-lightbox]');
  var gatilhos = document.querySelectorAll('[data-lightbox-abrir]');

  // <dialog> sem showModal (navegador antigo): deixamos os links de imagem
  // funcionando como navegação normal em vez de quebrar o clique.
  if (!dialogo || typeof dialogo.showModal !== 'function') {
    return;
  }

  var lbImg = dialogo.querySelector('[data-lightbox-img]');
  var lbLegenda = dialogo.querySelector('[data-lightbox-legenda]');
  var ultimoFoco = null;

  function abrir(botao) {
    var fonte = botao.getAttribute('data-src');
    var alt = botao.getAttribute('data-alt') || '';
    var legenda = botao.getAttribute('data-legenda') || '';

    lbImg.src = fonte;
    lbImg.alt = alt;
    lbLegenda.textContent = legenda;

    ultimoFoco = botao;
    dialogo.showModal();
  }

  /* Limpeza depois de fechar: libera a imagem grande e devolve o foco ao card
     que abriu o modal (sem isso, quem navega por teclado é jogado de volta
     para o início da página).

     É idempotente de propósito - a checagem do atributo src já serve de
     guarda: pode ser chamada pelo evento 'close', pelo botão de fechar e
     pelo Esc sem executar duas vezes. Não dependemos apenas do evento
     'close' porque ele é a única via para a tecla Esc, e queremos que o
     retorno de foco funcione mesmo se esse evento não chegar. */
  function aoFechar() {
    if (!lbImg.hasAttribute('src')) { return; }
    lbImg.removeAttribute('src');
    if (ultimoFoco && typeof ultimoFoco.focus === 'function') {
      ultimoFoco.focus();
    }
  }

  function fecharLightbox() {
    if (dialogo.open) { dialogo.close(); }
    aoFechar();
  }

  for (var g = 0; g < gatilhos.length; g++) {
    gatilhos[g].addEventListener('click', function (ev) {
      ev.preventDefault();
      abrir(ev.currentTarget);
    });
  }

  // Botão de fechar
  var botaoFechar = dialogo.querySelector('[data-lightbox-fechar]');
  if (botaoFechar) {
    botaoFechar.addEventListener('click', fecharLightbox);
  }

  /* Clique fora da imagem fecha. Comparamos o alvo com a área interna:
     clicar no ::backdrop reporta o próprio <dialog> como target. */
  dialogo.addEventListener('click', function (ev) {
    if (ev.target === dialogo) { fecharLightbox(); }
  });

  // Caminho padrão: o <dialog> emite 'close' ao fechar (inclusive pelo Esc).
  dialogo.addEventListener('close', aoFechar);

  /* Rede de segurança para o Esc: o <dialog> fecha sozinho na tecla Esc, e
     este listener garante a limpeza e o retorno de foco mesmo que o evento
     'close' não chegue. O setTimeout espera o navegador fechar o modal
     antes de devolvermos o foco. */
  dialogo.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' || ev.key === 'Esc') {
      setTimeout(aoFechar, 0);
    }
  });
})();
