
/* ============================================================================
 * BLACK WIDOW - V2 CORRIGIDO
 * ESP32 + Bluepad32 + controle PS5 DualSense
 * Tracao diferencial com dois motores
 *
 * Compatibilidade PWM:
 * - Arduino-ESP32 Core 2.x
 * - Arduino-ESP32 Core 3.x
 *
 * CONTROLES:
 * - Analógico esquerdo para cima: frente
 * - Analógico esquerdo para baixo: ré
 * - Analógico esquerdo para esquerda: giro à esquerda
 * - Analógico esquerdo para direita: giro à direita
 * - Botão Quadrado: frenagem elétrica
 * - Analógico centralizado: motores parados
 * ==========================================================================*/

#include <Bluepad32.h>

/* ---------------------- PINOS DOS MOTORES ---------------------- */

// Motor esquerdo
#define PIN_ENA  13
#define PIN_IN1  12
#define PIN_IN2  14

// Motor direito
#define PIN_ENB  25
#define PIN_IN3  27
#define PIN_IN4  26

/* ---------------------- CONFIGURACAO PWM ------------------------ */

#define PWM_FREQ       1000
#define PWM_RESOLUCAO  8
#define PWM_CANAL_ESQ  0
#define PWM_CANAL_DIR  1
#define PWM_MAX        255

/* ---------------------- CONFIGURACAO DE CONTROLE ---------------- */

#define ZONA_MORTA              50
#define VELOCIDADE_MINIMA       100
#define TIMEOUT_WATCHDOG_MS     1000

// Ajustes individuais para compensar diferencas entre motores.
float TRIM_ESQUERDO = 1.00f;
float TRIM_DIREITO  = 1.00f;

// Velocidade inicial.
uint8_t velocidadeAtual = 180;

// Controle Bluetooth conectado.
ControllerPtr meuControle = nullptr;

// Controle do watchdog.
uint32_t ultimoPacoteControle = 0;
bool watchdogAtivo = true;

/* ---------------------- COMANDOS DO ROBO ------------------------ */

enum Comando {
  CMD_FRENTE,
  CMD_TRAS,
  CMD_ESQUERDA,
  CMD_DIREITA,
  CMD_PARAR,
  CMD_FREAR
};

Comando comandoAtual = CMD_PARAR;

/* ============================================================================
 * CAMADA PWM
 * ==========================================================================*/

#if defined(ESP_ARDUINO_VERSION_MAJOR) && \
    (ESP_ARDUINO_VERSION_MAJOR >= 3)

  // Arduino-ESP32 Core 3.x
  static bool pwmInit(uint8_t pino, uint8_t canal) {
    (void)canal;
    return ledcAttach(pino, PWM_FREQ, PWM_RESOLUCAO);
  }

  static void pwmEscrever(uint8_t pino, uint8_t canal,
                          uint32_t duty) {
    (void)canal;
    ledcWrite(pino, duty);
  }

#else

  // Arduino-ESP32 Core 2.x
  static bool pwmInit(uint8_t pino, uint8_t canal) {
    ledcSetup(canal, PWM_FREQ, PWM_RESOLUCAO);
    ledcAttachPin(pino, canal);
    return true;
  }

  static void pwmEscrever(uint8_t pino, uint8_t canal,
                          uint32_t duty) {
    (void)pino;
    ledcWrite(canal, duty);
  }

#endif

/* ============================================================================
 * CAMADA DE MOTORES
 * ==========================================================================*/

static void acionarMotorEsq(bool in1, bool in2, uint8_t pwm) {
  digitalWrite(PIN_IN1, in1 ? HIGH : LOW);
  digitalWrite(PIN_IN2, in2 ? HIGH : LOW);
  pwmEscrever(PIN_ENA, PWM_CANAL_ESQ, pwm);
}

static void acionarMotorDir(bool in3, bool in4, uint8_t pwm) {
  digitalWrite(PIN_IN3, in3 ? HIGH : LOW);
  digitalWrite(PIN_IN4, in4 ? HIGH : LOW);
  pwmEscrever(PIN_ENB, PWM_CANAL_DIR, pwm);
}

// Calcula o PWM do motor esquerdo considerando o ajuste individual.
static uint8_t pwmEsq() {
  int valor = (int)(velocidadeAtual * TRIM_ESQUERDO);
  return (uint8_t)constrain(valor, 0, PWM_MAX);
}

// Calcula o PWM do motor direito considerando o ajuste individual.
static uint8_t pwmDir() {
  int valor = (int)(velocidadeAtual * TRIM_DIREITO);
  return (uint8_t)constrain(valor, 0, PWM_MAX);
}

void parar() {
  // PWM zero e entradas baixas: parada por desacionamento.
  acionarMotorEsq(false, false, 0);
  acionarMotorDir(false, false, 0);
}

void frear() {
  // Frenagem eletrica: ambas as entradas em nivel alto.
  // Requer driver cuja tabela-verdade permita essa frenagem.
  acionarMotorEsq(true, true, PWM_MAX);
  acionarMotorDir(true, true, PWM_MAX);
}

void frente() {
  acionarMotorEsq(true, false, pwmEsq());
  acionarMotorDir(true, false, pwmDir());
}

void tras() {
  acionarMotorEsq(false, true, pwmEsq());
  acionarMotorDir(false, true, pwmDir());
}

void girarEsquerda() {
  acionarMotorEsq(false, true, pwmEsq());
  acionarMotorDir(true, false, pwmDir());
}

void girarDireita() {
  acionarMotorEsq(true, false, pwmEsq());
  acionarMotorDir(false, true, pwmDir());
}

void receberComando(Comando cmd) {
  comandoAtual = cmd;

  switch (cmd) {
    case CMD_FRENTE:
      frente();
      break;

    case CMD_TRAS:
      tras();
      break;

    case CMD_ESQUERDA:
      girarEsquerda();
      break;

    case CMD_DIREITA:
      girarDireita();
      break;

    case CMD_PARAR:
      parar();
      break;

    case CMD_FREAR:
      frear();
      break;
  }
}

/* ============================================================================
 * CONEXAO E DESCONEXAO DO CONTROLE
 * ==========================================================================*/

void onConnectedController(ControllerPtr ctl) {
  // Aceita apenas um controle por vez.
  if (meuControle == nullptr && ctl->isGamepad()) {
    meuControle = ctl;

    // O robo permanece parado ao conectar.
    parar();

    ultimoPacoteControle = millis();
    watchdogAtivo = false;

    Serial.println();
    Serial.println("[SUCESSO] Controle conectado ao Black Widow!");
    Serial.println("[INFO] Centralize o analogico para manter o robo parado.");
  }
}

void onDisconnectedController(ControllerPtr ctl) {
  if (meuControle == ctl) {
    // Interrompe os motores imediatamente.
    parar();

    meuControle = nullptr;
    watchdogAtivo = true;

    Serial.println();
    Serial.println("[AVISO] Controle desconectado!");
    Serial.println("[SEGURANCA] Motores desacionados.");
  }
}

/* ============================================================================
 * LEITURA E INTERPRETACAO DO CONTROLE
 * ==========================================================================*/

void processarControle() {
  if (meuControle == nullptr || !meuControle->isConnected()) {
    parar();
    return;
  }

  // Eixos do analogico esquerdo: faixa aproximada de -511 a +512.
  // Y negativo = para cima; Y positivo = para baixo.
  int joystickY = meuControle->axisY();
  int joystickX = meuControle->axisX();

  Serial.printf(
  "X=%d | Y=%d | Quadrado=%d\n",
  joystickX,
  joystickY,
  meuControle->x()
);

  // No Bluepad32, x() representa o botao Quadrado do DualSense.
  bool botaoQuadrado = meuControle->x();

  // O freio tem prioridade sobre os comandos de movimento.
  if (botaoQuadrado) {
    receberComando(CMD_FREAR);
    return;
  }

  // Movimento para frente.
  if (joystickY < -ZONA_MORTA) {
    int intensidade = constrain(abs(joystickY),
                                ZONA_MORTA, 512);

    velocidadeAtual = (uint8_t)constrain(
      map(intensidade, ZONA_MORTA, 512,
          VELOCIDADE_MINIMA, PWM_MAX),
      VELOCIDADE_MINIMA, PWM_MAX
    );

    receberComando(CMD_FRENTE);
  }

  // Movimento para tras.
  else if (joystickY > ZONA_MORTA) {
    int intensidade = constrain(joystickY,
                                ZONA_MORTA, 512);

    velocidadeAtual = (uint8_t)constrain(
      map(intensidade, ZONA_MORTA, 512,
          VELOCIDADE_MINIMA, PWM_MAX),
      VELOCIDADE_MINIMA, PWM_MAX
    );

    receberComando(CMD_TRAS);
  }

  // Giro no proprio eixo para a esquerda.
  else if (joystickX < -ZONA_MORTA) {
    int intensidade = constrain(abs(joystickX),
                                ZONA_MORTA, 511);

    velocidadeAtual = (uint8_t)constrain(
      map(intensidade, ZONA_MORTA, 511,
          VELOCIDADE_MINIMA, PWM_MAX),
      VELOCIDADE_MINIMA, PWM_MAX
    );

    receberComando(CMD_ESQUERDA);
  }

  // Giro no proprio eixo para a direita.
  else if (joystickX > ZONA_MORTA) {
    int intensidade = constrain(joystickX,
                                ZONA_MORTA, 512);

    velocidadeAtual = (uint8_t)constrain(
      map(intensidade, ZONA_MORTA, 512,
          VELOCIDADE_MINIMA, PWM_MAX),
      VELOCIDADE_MINIMA, PWM_MAX
    );

    receberComando(CMD_DIREITA);
  }

  // Analógico dentro da zona morta: para os motores.
  else {
    velocidadeAtual = 180;
    receberComando(CMD_PARAR);
  }
}

/* ============================================================================
 * SETUP
 * ==========================================================================*/

void setup() {
  Serial.begin(115200);

  // Configura as entradas do driver dos motores.
  pinMode(PIN_IN1, OUTPUT);
  pinMode(PIN_IN2, OUTPUT);
  pinMode(PIN_IN3, OUTPUT);
  pinMode(PIN_IN4, OUTPUT);

  // Garante que os motores nao sejam acionados durante a inicializacao.
  digitalWrite(PIN_IN1, LOW);
  digitalWrite(PIN_IN2, LOW);
  digitalWrite(PIN_IN3, LOW);
  digitalWrite(PIN_IN4, LOW);

  bool pwmEsqOK = pwmInit(PIN_ENA, PWM_CANAL_ESQ);
  bool pwmDirOK = pwmInit(PIN_ENB, PWM_CANAL_DIR);

  if (!pwmEsqOK || !pwmDirOK) {
    Serial.println("[ERRO] Falha ao inicializar o PWM!");
    parar();

    while (true) {
      delay(1000);
    }
  }

  parar();

  Serial.println();
  Serial.println("========================================");
  Serial.println("       BLACK WIDOW V2 - INICIANDO");
  Serial.println("========================================");

  // Inicializa o Bluepad32 e registra os callbacks.
  BP32.setup(&onConnectedController, &onDisconnectedController);

  Serial.println("[INFO] Bluetooth inicializado.");
  Serial.println("[INFO] Ligue o controle PS5 para conectar.");
}

/* ============================================================================
 * LOOP PRINCIPAL
 * ==========================================================================*/

void loop() {
  // Atualiza o estado Bluetooth e processa eventos do controle.
  bool dadosNovos = BP32.update();

  if (meuControle != nullptr && meuControle->isConnected()) {

    // Renova o watchdog somente quando chegam dados novos.
    if (dadosNovos) {
      ultimoPacoteControle = millis();
      watchdogAtivo = false;

      processarControle();
    }

    // Se os pacotes pararem de chegar, desaciona os motores.
    if (!watchdogAtivo &&
        (uint32_t)(millis() - ultimoPacoteControle) >=
        TIMEOUT_WATCHDOG_MS) {

      parar();
      watchdogAtivo = true;

      Serial.println(
        "[ALERTA] Watchdog acionado: dados do controle interrompidos."
      );
    }
  }
  else {
    // Sem controle conectado, nunca manter os motores acionados.
    if (!watchdogAtivo) {
      parar();
      watchdogAtivo = true;
    }
  }

  delay(5);
}
