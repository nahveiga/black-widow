/* =========================================================================
   EVIDÊNCIAS DO PROJETO - FONTE ÚNICA DE VERDADE
   -------------------------------------------------------------------------
   Registro fotográfico e em vídeo das etapas. A seção "Evidências" da home é
   montada inteiramente a partir deste array, incluindo os cards das
   evidências que ainda não foram registradas.

   Campos de cada item:
     titulo    curto, aparece como título do card
     tarefa    descrição completa do que o registro mostra
     tipo      "foto" | "video"
     etapa     rótulo da frente de trabalho ("Mecânica", "Testes", ...)
     status    "ok"      -> o arquivo existe e é exibido
               "pendente" -> card tracejado, sem mídia, como lembrete
     arquivo   caminho do .jpg ou .mp4          (só quando status = "ok")
     webp      versão .webp da foto, opcional   (só quando status = "ok")
     poster    imagem de capa do vídeo          (só para tipo = "video")
     alt       descrição da imagem para leitor de tela e para quem está com
               as imagens desligadas. Descreve o que SE VÊ na foto.
     largura /
     altura    dimensões reais em px - reservam o espaço e evitam que o
               texto "salte" quando a imagem termina de carregar
     detalhe   linha técnica opcional (usada no vídeo)

   PARA ADICIONAR UMA EVIDÊNCIA QUE ESTAVA PENDENTE:
     1. coloque o arquivo em img/ (nome em kebab-case, sem acentos);
     2. no item correspondente, troque status para "ok";
     3. preencha arquivo, webp, alt, largura e altura.
   Nenhuma outra alteração é necessária.
   ========================================================================= */

window.BW = window.BW || {};

window.BW.evidencias = [
  // --------------------------- DISPONÍVEIS ------------------------------
  {
    titulo: "Projeto conceitual do robô",
    tipo: "foto",
    etapa: "Mecânica",
    status: "ok",
    arquivo: "img/prototipo.jpg",
    webp: "img/prototipo.webp",
    largura: 1402,
    altura: 1122,
    alt: "Prancha de concepção do robô, identificada como R3, reunindo vista " +
      "superior, frontal e lateral, o esquema de distribuição interna dos " +
      "componentes e a lista de características.",
    tarefa: "Representação do projeto do Black Widow, elaborada na etapa de " +
      "concepção. A imagem apresenta a configuração definida para o robô: " +
      "chassi de perfil baixo, duas rodas traseiras motorizadas de forma " +
      "independente e rampa frontal inclinada como elemento de combate. O " +
      "projeto serviu de referência para o dimensionamento da estrutura e " +
      "para a definição do posicionamento dos componentes eletrônicos."
  },
  {
    titulo: "Conjunto mecânico montado",
    tipo: "foto",
    etapa: "Mecânica",
    status: "ok",
    arquivo: "img/robo-montado.jpg",
    webp: "img/robo-montado.webp",
    largura: 1200,
    altura: 1600,
    alt: "Chassi de acrílico transparente do robô segurado na mão, com rodas " +
      "amarelas e pretas, motores fixados e a eletrônica de controle montada " +
      "em protoboard com diversos jumpers.",
    tarefa: "Registro do robô após a montagem da estrutura, instalação das " +
      "rodas e fixação dos motores. Nesta configuração, o conjunto mecânico " +
      "está completo e alinhado, com as duas rodas traseiras acopladas aos " +
      "motores e a roda dianteira atuando como apoio. A partir deste ponto, o " +
      "trabalho passou para a integração da eletrônica de controle."
  },
  {
    titulo: "Teste de acionamento dos motores",
    tipo: "video",
    etapa: "Testes",
    status: "ok",
    arquivo: "videos/funcionamento.mp4",
    poster: "img/poster-video.jpg",
    largura: 478,
    altura: 850,
    detalhe: "17 s · MP4 · 478×850",
    tarefa: "Registro do ensaio de funcionamento do sistema de tração. O " +
      "teste verifica o acionamento, o sentido de rotação das rodas e a " +
      "resposta ao comando de velocidade enviado pelo ESP32."
  },

  // ---------------------------- PENDENTES -------------------------------
  {
    titulo: "Componentes recebidos",
    tipo: "foto",
    etapa: "Mecânica",
    status: "pendente",
    tarefa: "Registro dos componentes adquiridos antes do início da montagem, " +
      "conforme especificação da planilha de orçamento: microcontrolador " +
      "ESP32, módulo ponte H L298N, motores de corrente contínua, rodas, " +
      "bateria e materiais estruturais. A conferência do material recebido " +
      "foi feita item a item contra a lista de compras antes do início da " +
      "montagem."
  },
  {
    titulo: "Estrutura do chassi montada",
    tipo: "foto",
    etapa: "Mecânica",
    status: "pendente",
    tarefa: "Registro da estrutura base após a montagem e antes da instalação " +
      "das rodas, evidenciando as furações de fixação dos motores e o " +
      "alinhamento dos alojamentos. O alinhamento foi conferido nesta etapa " +
      "porque correções após a fixação das rodas exigiriam desmontagem do " +
      "conjunto."
  },
  {
    titulo: "Instalação das rodas",
    tipo: "foto",
    etapa: "Mecânica",
    status: "pendente",
    tarefa: "Fixação das rodas traseiras aos eixos dos motores e da roda " +
      "dianteira de apoio. Verificou-se o contato simultâneo das três rodas " +
      "com a superfície, condição necessária para que o robô não perca tração " +
      "durante as manobras."
  }
];

/* Aparência de cada tipo e status. Como na timeline, a informação nunca
   depende só da cor: há sempre ícone E rótulo escrito. */
window.BW.evidenciaInfo = {
  tipo: {
    foto:  { rotulo: "Foto",  icone: "▣" },  // ▣
    video: { rotulo: "Vídeo", icone: "▶" }   // ▶
  },
  status: {
    ok:       { rotulo: "Registrado", icone: "✓" }, // ✓
    pendente: { rotulo: "Pendente",   icone: "○" }  // ○
  }
};
