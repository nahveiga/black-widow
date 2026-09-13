/* =========================================================================
   PÁGINA ORÇAMENTO - preview da planilha com SheetJS
   -------------------------------------------------------------------------
   O preview LÊ O ARQUIVO REAL (arquivos/orcamento-black-widow.xlsx).
   Nenhum valor é escrito no código: se a planilha mudar, o preview muda.

   LIMITAÇÃO IMPORTANTE - protocolo file://
   Abrindo o HTML com duplo clique, a URL fica file:// e o navegador bloqueia
   fetch de arquivos locais por política de origem (CORS). Não é bug do
   código nem da planilha: é uma regra de segurança do navegador.
   Nesse caso mostramos uma explicação com o comando do servidor local e
   MANTEMOS o botão de download funcionando - ele é um link comum, não
   depende de fetch nem de JavaScript.
   ========================================================================= */

(function () {
  'use strict';

  var CAMINHO = 'arquivos/orcamento-black-widow.xlsx';
  var CDN_SHEETJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

  var elAbas     = document.querySelector('[data-abas]');
  var elMoldura  = document.querySelector('[data-tabela-moldura]');
  var elCarrega  = document.querySelector('[data-preview-carregando]');
  var elErro     = document.querySelector('[data-preview-erro]');
  var elErroTexto= document.querySelector('[data-preview-erro-texto]');
  var elServidor = document.querySelector('[data-preview-servidor]');

  if (!elMoldura) { return; }

  var pastaWorkbook = null;

  // ------------------------------ UTILIDADES ------------------------------
  function esconder(el) { if (el) { el.hidden = true; } }
  function mostrar(el) { if (el) { el.hidden = false; } }

  function falhar(mensagem) {
    esconder(elCarrega);
    esconder(elMoldura);
    esconder(elAbas);
    mostrar(elErro);
    if (elErroTexto) { elErroTexto.textContent = mensagem; }
  }

  /* Caso específico do file://: mensagem própria, com o comando para rodar
     o servidor local. Separada do erro genérico porque a ação que o usuário
     precisa tomar é completamente diferente. */
  function avisarServidorNecessario() {
    esconder(elCarrega);
    esconder(elMoldura);
    esconder(elAbas);
    esconder(elErro);
    mostrar(elServidor);
  }

  function carregarScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('CDN inacessível')); };
      document.head.appendChild(s);
    });
  }

  // --------------------- MONTAGEM DA TABELA A PARTIR DA ABA ---------------
  /* Lemos célula por célula (em vez de usar sheet_to_html) por três motivos:
       1. controle total do HTML, para casar com o tema escuro do site;
       2. acesso ao texto JÁ FORMATADO pelo Excel (cell.w), que respeita o
          formato de número salvo no arquivo;
       3. acesso ao tipo da célula (cell.t), que diz o que é número de
          verdade - assim alinhamos à direita sem adivinhar por regex. */
  function lerGrade(aba) {
    if (!aba || !aba['!ref']) { return []; }

    var faixa = XLSX.utils.decode_range(aba['!ref']);
    var grade = [];

    for (var R = faixa.s.r; R <= faixa.e.r; R++) {
      var linha = [];
      for (var C = faixa.s.c; C <= faixa.e.c; C++) {
        var celula = aba[XLSX.utils.encode_cell({ r: R, c: C })];
        var texto = '';
        if (celula) {
          // cell.w = texto formatado como o Excel exibe; cai para o valor cru
          texto = (celula.w !== undefined && celula.w !== null)
            ? celula.w
            : String(celula.v !== undefined ? celula.v : '');
        }
        linha.push({
          texto: String(texto).trim(),
          numero: !!(celula && celula.t === 'n')
        });
      }
      grade.push(linha);
    }
    return grade;
  }

  function linhaVazia(linha) {
    return linha.every(function (c) { return c.texto === ''; });
  }

  /* Apara linhas e colunas totalmente vazias nas bordas.
     Necessário aqui: nesta planilha os dados começam na coluna B, e sem a
     aparagem o preview mostraria uma primeira coluna vazia. */
  function aparar(grade) {
    // Linhas das pontas
    while (grade.length && linhaVazia(grade[0])) { grade.shift(); }
    while (grade.length && linhaVazia(grade[grade.length - 1])) { grade.pop(); }
    if (!grade.length) { return grade; }

    var nCols = grade[0].length;

    function colunaVazia(c) {
      return grade.every(function (linha) {
        return !linha[c] || linha[c].texto === '';
      });
    }

    var inicio = 0;
    while (inicio < nCols && colunaVazia(inicio)) { inicio++; }
    var fim = nCols - 1;
    while (fim > inicio && colunaVazia(fim)) { fim--; }

    return grade.map(function (linha) { return linha.slice(inicio, fim + 1); });
  }

  function montarTabela(grade, nomeAba) {
    grade = aparar(grade);

    var tabela = document.createElement('table');
    tabela.className = 'tabela-planilha';

    if (!grade.length) {
      var vazio = document.createElement('caption');
      vazio.textContent = 'A aba "' + nomeAba + '" está vazia.';
      tabela.appendChild(vazio);
      return tabela;
    }

    /* Primeira linha com uma única célula preenchida = título da planilha
       (nesta planilha ele está mesclado em B1:D1). Vira <caption>, que é o
       elemento semântico correto para o título de uma tabela. */
    var preenchidas = grade[0].filter(function (c) { return c.texto !== ''; });
    if (grade.length > 1 && preenchidas.length === 1) {
      var cap = document.createElement('caption');
      cap.className = 'tabela-titulo';
      cap.textContent = preenchidas[0].texto;
      tabela.appendChild(cap);
      grade = grade.slice(1);
      // Pode haver linha em branco separando o título do cabeçalho
      while (grade.length > 1 && linhaVazia(grade[0])) { grade = grade.slice(1); }
    }

    // Primeira linha restante = cabeçalho da tabela
    var cabecalho = grade[0];
    var corpo = grade.slice(1);

    var thead = document.createElement('thead');
    var trh = document.createElement('tr');
    cabecalho.forEach(function (celula) {
      var th = document.createElement('th');
      th.scope = 'col';
      th.textContent = celula.texto;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    tabela.appendChild(thead);

    var tbody = document.createElement('tbody');
    corpo.forEach(function (linha) {
      if (linhaVazia(linha)) { return; }

      var tr = document.createElement('tr');

      // Linha de total: destacada pelo texto da primeira célula, não pela
      // posição - assim continua funcionando se a planilha crescer.
      var primeira = linha[0] ? linha[0].texto : '';
      if (/^total/i.test(primeira)) { tr.className = 'linha-total'; }

      linha.forEach(function (celula, idx) {
        // A primeira coluna é o nome do item: vira <th scope="row">,
        // o que dá contexto a quem navega a tabela por leitor de tela.
        var cel = document.createElement(idx === 0 ? 'th' : 'td');
        if (idx === 0) { cel.scope = 'row'; }
        if (celula.numero) { cel.className = 'num'; }
        cel.textContent = celula.texto;
        tr.appendChild(cel);
      });

      // Completa linhas curtas para a tabela não ficar "dentada"
      while (tr.children.length < cabecalho.length) {
        tr.appendChild(document.createElement('td'));
      }

      tbody.appendChild(tr);
    });
    tabela.appendChild(tbody);

    return tabela;
  }

  function renderizarAba(nome) {
    var aba = pastaWorkbook.Sheets[nome];
    elMoldura.innerHTML = '';
    elMoldura.appendChild(montarTabela(lerGrade(aba), nome));
    // Volta o scroll ao início ao trocar de aba
    elMoldura.scrollTop = 0;
    elMoldura.scrollLeft = 0;
  }

  // --------------------------------- ABAS ---------------------------------
  /* As abas só aparecem se a planilha tiver mais de uma. Com uma única aba,
     uma barra de abas seria ruído puro. */
  function montarAbas(nomes) {
    if (!elAbas) { return; }

    if (nomes.length < 2) {
      esconder(elAbas);
      return;
    }

    elAbas.innerHTML = '';
    elAbas.setAttribute('role', 'tablist');
    elAbas.setAttribute('aria-label', 'Abas da planilha');

    var botoes = [];

    nomes.forEach(function (nome, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'aba';
      b.textContent = nome;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      // Somente a aba ativa fica na ordem de tabulação (padrão ARIA tabs):
      // as setas do teclado navegam entre as demais.
      b.tabIndex = i === 0 ? 0 : -1;

      b.addEventListener('click', function () { selecionar(i); });

      b.addEventListener('keydown', function (ev) {
        var passo = ev.key === 'ArrowRight' ? 1 : (ev.key === 'ArrowLeft' ? -1 : 0);
        if (!passo) { return; }
        ev.preventDefault();
        selecionar((i + passo + nomes.length) % nomes.length, true);
      });

      botoes.push(b);
      elAbas.appendChild(b);
    });

    function selecionar(indice, focar) {
      botoes.forEach(function (b, j) {
        var ativa = j === indice;
        b.setAttribute('aria-selected', ativa ? 'true' : 'false');
        b.tabIndex = ativa ? 0 : -1;
      });
      if (focar) { botoes[indice].focus(); }
      renderizarAba(nomes[indice]);
    }

    mostrar(elAbas);
  }

  // ------------------------------- ARRANQUE -------------------------------
  function iniciar() {
    /* Checagem antes de qualquer download: em file:// o fetch vai falhar de
       qualquer jeito, então nem baixamos o SheetJS (~900 KB) em vão. */
    if (window.location.protocol === 'file:') {
      avisarServidorNecessario();
      return;
    }

    mostrar(elCarrega);

    carregarScript(CDN_SHEETJS)
      .then(function () {
        return fetch(CAMINHO);
      })
      .then(function (resposta) {
        if (!resposta.ok) {
          throw new Error('A planilha respondeu HTTP ' + resposta.status + '.');
        }
        return resposta.arrayBuffer();
      })
      .then(function (buffer) {
        pastaWorkbook = XLSX.read(buffer, { type: 'array', cellStyles: false });

        var nomes = pastaWorkbook.SheetNames || [];
        if (!nomes.length) { throw new Error('A planilha não tem nenhuma aba.'); }

        montarAbas(nomes);
        renderizarAba(nomes[0]);

        esconder(elCarrega);
        esconder(elErro);
        esconder(elServidor);
        mostrar(elMoldura);
      })
      .catch(function (erro) {
        var msg = (erro && erro.message) || 'erro desconhecido';

        // TypeError de fetch normalmente é bloqueio de origem ou rede.
        if (erro instanceof TypeError) {
          msg = 'O navegador bloqueou a leitura do arquivo (política de origem) ' +
                'ou a rede falhou.';
        }
        falhar('Não foi possível exibir o preview: ' + msg +
               ' O download ao lado continua funcionando normalmente.');
        console.warn('[orcamento] preview indisponível:', erro);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
