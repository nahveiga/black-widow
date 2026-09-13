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

   O campo "descricao" e o paragrafo exibido abaixo do titulo.

   OBS 1: o arquivo esta em UTF-8. Os textos visiveis levam acentuacao
   normal do portugues - a regra de "sem acentos" vale so para NOME DE
   ARQUIVO, nunca para o conteudo exibido.

   OBS 2: usamos script classico (sem "type=module" / import) de proposito.
   Modulos ES sao bloqueados por CORS no protocolo file://, e um dos
   requisitos do projeto e o site abrir com duplo clique.
   ========================================================================= */

// Namespace global do site, compartilhado entre os scripts.
window.BW = window.BW || {};

window.BW.etapas = [
  // ---------------------------- CONCLUÍDO -------------------------------
  {
    titulo: "Definição do conceito e do projeto do robô",
    status: "concluido",
    descricao: "Levantamento dos requisitos da disciplina e definição da " +
      "arquitetura do robô. Optou-se por uma configuração de três rodas, com " +
      "duas rodas traseiras motorizadas individualmente e uma roda dianteira " +
      "livre, apenas de apoio. Essa escolha permite tração diferencial: " +
      "variando a velocidade e o sentido de cada motor traseiro de forma " +
      "independente, o robô avança, recua e gira sobre o próprio eixo sem " +
      "necessidade de sistema de direção. Definiu-se também a rampa frontal " +
      "como elemento de combate."
  },
  {
    titulo: "Levantamento de componentes e orçamento",
    status: "concluido",
    descricao: "Especificação de todos os componentes eletrônicos, mecânicos " +
      "e estruturais necessários, com pesquisa de preços e fornecedores. O " +
      "resultado foi consolidado em planilha de orçamento, disponível para " +
      "consulta na aba Orçamento. A definição antecipada dos componentes foi " +
      "necessária para dimensionar corretamente o chassi e a alimentação do " +
      "sistema."
  },
  {
    titulo: "Compra das peças",
    status: "concluido",
    descricao: "Aquisição dos componentes especificados no orçamento, " +
      "incluindo microcontrolador ESP32, módulo ponte H, motores de corrente " +
      "contínua, rodas, bateria e materiais estruturais."
  },
  {
    titulo: "Montagem do chassi",
    status: "concluido",
    descricao: "Montagem básica da estrutura base do robô."
  },
  {
    titulo: "Instalação das rodas",
    status: "concluido",
    descricao: "Fixação das duas rodas traseiras motorizadas e da roda " +
      "dianteira de apoio. Verificou-se o nivelamento do conjunto para que as " +
      "três rodas mantivessem contato simultâneo com o solo, condição " +
      "necessária para a estabilidade durante o combate."
  },
  {
    titulo: "Instalação e fixação dos motores",
    status: "concluido",
    descricao: "Montagem dos dois motores de corrente contínua na estrutura " +
      "traseira e acoplamento aos eixos das rodas. A fixação rígida é " +
      "essencial: folga no suporte gera vibração e perda de torque no impacto " +
      "contra o robô adversário."
  },

  // --------------------------- EM ANDAMENTO -----------------------------
  {
    titulo: "Eletrônica de controle: ESP32 + ponte H L298N",
    status: "andamento",
    descricao: "Montagem do circuito de acionamento. O ESP32 atua como " +
      "unidade de processamento e o módulo L298N como ponte H, recebendo os " +
      "sinais de controle e chaveando a potência dos motores. Cada canal do " +
      "driver utiliza dois pinos digitais para definir o sentido de rotação e " +
      "um pino habilitador, que recebe o sinal PWM responsável pelo controle " +
      "de velocidade. O terra do ESP32 e o do driver são interligados, pois o " +
      "sinal PWM precisa de referência comum para ser interpretado " +
      "corretamente."
  },
  {
    titulo: "Firmware V1: controle por Wi-Fi",
    status: "andamento",
    descricao: "Desenvolvimento do firmware em C++ na IDE Arduino. O ESP32 é " +
      "configurado em modo Access Point, criando a própria rede Wi-Fi e " +
      "dispensando roteador externo — o operador conecta diretamente ao robô. " +
      "O firmware implementa as rotinas de movimento (avanço, recuo, giro à " +
      "esquerda, giro à direita, parada por inércia e frenagem ativa), geração " +
      "de PWM por hardware através do periférico LEDC e um watchdog de " +
      "segurança que corta os motores caso nenhum comando seja recebido dentro " +
      "do intervalo estabelecido, evitando que o robô continue acelerando em " +
      "caso de falha de comunicação."
  },
  {
    titulo: "Interface web de controle",
    status: "andamento",
    descricao: "Desenvolvimento da interface de operação em HTML, CSS e " +
      "JavaScript, embarcada na memória do próprio ESP32 e servida por " +
      "requisição HTTP. A escolha por interface web dispensa a instalação de " +
      "aplicativo e funciona em qualquer dispositivo com navegador. A " +
      "interface possui grade direcional acionada por toque, ajuste contínuo " +
      "de velocidade, indicador de estado da conexão e botão de parada de " +
      "emergência."
  },

  // ----------------------------- PENDENTE -------------------------------
  {
    titulo: "Testes de movimentação e calibração",
    status: "pendente",
    descricao: "Verificação do sentido de rotação de cada motor, da resposta " +
      "ao ajuste de velocidade e do funcionamento do watchdog, inicialmente " +
      "com o robô suspenso e as rodas livres. Em seguida, calibração dos " +
      "fatores de compensação entre os motores: como não há encoders, a " +
      "diferença natural de rendimento entre os dois motores é corrigida em " +
      "malha aberta, ajustando empiricamente a potência de cada lado até que o " +
      "robô descreva trajetória retilínea."
  },
  {
    titulo: "Projeto e fabricação da rampa frontal",
    status: "pendente",
    descricao: "Projeto da estrutura de combate em formato de rampa, " +
      "considerando resistência mecânica, estabilidade e distribuição de peso. " +
      "A geometria em rampa tem por função posicionar-se sob o robô adversário " +
      "durante o contato, transferindo o impulso para desestabilizá-lo e " +
      "deslocá-lo."
  },
  {
    titulo: "Integração da rampa ao chassi",
    status: "pendente",
    descricao: "Fixação da rampa à estrutura e verificação do comportamento " +
      "do conjunto. O deslocamento do centro de massa para a frente será " +
      "avaliado, pois afeta diretamente a tração das rodas traseiras e a " +
      "estabilidade do robô."
  },
  {
    titulo: "Migração para controle Bluetooth (V2)",
    status: "pendente",
    descricao: "Substituição do enlace Wi-Fi por comunicação Bluetooth com " +
      "controle físico. O firmware foi estruturado com a camada de comando " +
      "isolada das rotinas de motor, de modo que a migração exige apenas a " +
      "troca da origem do comando, sem reescrever a lógica de movimentação."
  },
  {
    titulo: "Testes finais e ajustes",
    status: "pendente",
    descricao: "Ensaios do conjunto completo, avaliação de autonomia da " +
      "bateria, aquecimento do driver e comportamento em situação de impacto."
  },
  {
    titulo: "Entrega e apresentação",
    status: "pendente",
    descricao: "Apresentação do robô e da documentação do projeto."
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
