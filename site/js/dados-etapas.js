/* =========================================================================
   DADOS DAS ETAPAS DO PROJETO - FONTE UNICA DE VERDADE
   -------------------------------------------------------------------------
   Este e o UNICO lugar para editar o andamento do projeto. A linha do tempo,
   a barra de progresso e os contadores da pagina etapas.html sao todos
   gerados a partir deste array. A porcentagem e CALCULADA em tempo de
   execucao - nao existe numero escrito a mao para desatualizar.

   Para atualizar uma etapa, mude apenas o campo "status":
       "concluido"  -> verde, icone de check, titulo riscado
       "andamento"  -> vermelho, icone cheio, pulsando
       "pendente"   -> cinza, icone vazio, contorno tracejado

   O campo "nota" e opcional; quando existe, aparece como texto de apoio.

   OBS 1: o arquivo esta em UTF-8. Os textos visiveis levam acentuacao
   normal do portugues - a regra de "sem acentos" vale so para NOME DE
   ARQUIVO, nunca para o conteudo exibido.

   OBS 2: usamos script classico (sem "type=module" / import) de proposito.
   Modulos ES sao bloqueados por CORS no protocolo file://, e um dos
   requisitos do projeto e o site abrir com duplo clique no arquivo.
   ========================================================================= */

// Namespace global do site, compartilhado entre os scripts.
window.BW = window.BW || {};

window.BW.etapas = [
  // ---------------------------- CONCLUÍDO -------------------------------
  {
    titulo: "Definição do conceito e do projeto do robô",
    status: "concluido",
    nota: "Arquitetura de três rodas com tração diferencial nas duas traseiras."
  },
  {
    titulo: "Levantamento de componentes e orçamento",
    status: "concluido",
    nota: "Planilha de custos disponível na página Orçamento."
  },
  {
    titulo: "Compra das peças",
    status: "concluido"
  },
  {
    titulo: "Montagem do chassi",
    status: "concluido"
  },
  {
    titulo: "Instalação das rodas",
    status: "concluido",
    nota: "Duas rodas traseiras motorizadas e uma dianteira livre, de apoio."
  },
  {
    titulo: "Instalação e fixação dos motores",
    status: "concluido"
  },

  // --------------------------- EM ANDAMENTO -----------------------------
  {
    titulo: "Eletrônica de controle — ESP32 + ponte H L298N",
    status: "andamento",
    nota: "Ligação do microcontrolador à ponte H e à alimentação."
  },
  {
    titulo: "Firmware V1 — controle por Wi-Fi",
    status: "andamento",
    nota: "ESP32 operando em modo Access Point, sem depender de rede externa."
  },
  {
    titulo: "Interface web de controle",
    status: "andamento",
    nota: "Página servida pelo próprio ESP32 para comandar o robô."
  },

  // ----------------------------- PENDENTE -------------------------------
  {
    titulo: "Testes de movimentação e calibração dos motores",
    status: "pendente"
  },
  {
    titulo: "Projeto e fabricação da rampa frontal",
    status: "pendente",
    nota: "Estrutura em rampa para atingir e deslocar o robô adversário."
  },
  {
    titulo: "Integração da rampa ao chassi",
    status: "pendente"
  },
  {
    titulo: "Migração para controle Bluetooth (V2)",
    status: "pendente"
  },
  {
    titulo: "Testes finais e ajustes",
    status: "pendente"
  },
  {
    titulo: "Entrega e apresentação",
    status: "pendente"
  }
];

/* Aparência de cada status: ícone e rótulo de texto.
   O rótulo existe para que a informação NÃO dependa apenas da cor -
   requisito de acessibilidade para quem tem daltonismo. */
window.BW.statusInfo = {
  concluido: { icone: "✓", rotulo: "Concluído",    classe: "etapa--concluido" }, // ✓
  andamento: { icone: "●", rotulo: "Em andamento", classe: "etapa--andamento" }, // ●
  pendente:  { icone: "○", rotulo: "Pendente",     classe: "etapa--pendente"  }  // ○
};
