/* ============================================================================
 * BLACK WIDOW - V4 (RODAS + ARMA | BLUETOOTH OU WIFI)
 * ESP32 + L298N (rodas) + BTS7960 (arma)
 *
 * Compatibilidade PWM:
 * - Arduino-ESP32 Core 2.x
 * - Arduino-ESP32 Core 3.x
 *
 * ---------------------------------------------------------------------------
 * ESCOLHA DO MODO: altere MODO_CONTROLE logo abaixo.
 *
 *  MODO_BLUETOOTH (competicao) - controle PS5 via Bluepad32
 *   - Analogico esquerdo cima/baixo:   frente / re
 *   - Analogico esquerdo esq/dir:      giro no proprio eixo
 *   - Quadrado:                        frenagem eletrica (rodas)
 *   - Gatilho R2:                      arma (quanto mais aperta, mais rapido,
 *                                      sempre com aceleracao gradual)
 *
 *  MODO_WIFI (testes em casa) - pagina web no celular
 *   1. Conecte o celular na rede WIFI_NOME (senha WIFI_SENHA)
 *   2. Abra o navegador em http://192.168.4.1
 *   - Setas (segurar):                 movimento
 *   - FREIO (segurar):                 frenagem eletrica
 *   - Botao ARMA:                      1 toque liga / outro toque desliga
 *   - Sliders:                         velocidade das rodas e da arma
 *
 * PACOTE DE PLACA (Ferramentas > Placa) - depende do modo:
 *   - MODO_BLUETOOTH: "ESP32 Dev Module" do esp32_bluepad32
 *                     (FQBN esp32-bluepad32:esp32:esp32). Bluepad32 so existe nele.
 *   - MODO_WIFI:      "ESP32 Dev Module" do esp32 padrao da Espressif
 *                     (FQBN esp32:esp32:esp32). O esp32_bluepad32 liga o
 *                     Bluetooth mesmo sem usar e ele disputa o radio com o
 *                     WiFi: medido 25-60% de perda e comandos de 1-5 s,
 *                     contra 0% de perda e ~20 ms no pacote padrao.
 *
 * SEGURANCA (nos dois modos):
 *   - A arma acelera em rampa e desliga na hora (roda livre) ao soltar.
 *   - Controle desconectado / sem dados: rodas E arma desligam.
 *   - Bluetooth: o R2 precisa ser visto SOLTO apos conectar antes de armar.
 *   - WiFi: apos perda de conexao, a arma so religa com novo toque no botao.
 * ==========================================================================*/

/* ---------------------- MODO DE CONTROLE ------------------------ */

#define MODO_BLUETOOTH  1
#define MODO_WIFI       2

#define MODO_CONTROLE   MODO_WIFI        // <<< troque para MODO_WIFI em casa

#if MODO_CONTROLE == MODO_BLUETOOTH
  #include <Bluepad32.h>
#elif MODO_CONTROLE == MODO_WIFI
  #include <WiFi.h>
  #include <WebServer.h>
#else
  #error "MODO_CONTROLE invalido: use MODO_BLUETOOTH ou MODO_WIFI"
#endif

/* ---------------------- PINOS DOS MOTORES (RODAS) --------------- */

// Motor esquerdo
#define PIN_ENA  13
#define PIN_IN1  12   // pino de strapping: se a ESP nao ligar, mova para o 4
#define PIN_IN2  14

// Motor direito
#define PIN_ENB  25
#define PIN_IN3  27
#define PIN_IN4  26

/* ---------------------- PINOS DA ARMA (BTS7960) ----------------- */

#define PIN_ARMA_PWM   18   // RPWM do BTS7960
#define PIN_ARMA_EN    19   // R_EN + L_EN juntos
// LPWM do BTS7960 ligado no GND (arma gira so em um sentido)

/* ---------------------- CONFIGURACAO PWM ------------------------ */

#define PWM_FREQ_RODAS   1000
#define PWM_FREQ_ARMA    20000   // 20 kHz: fora da faixa audivel, ok p/ BTS7960
#define PWM_RESOLUCAO    8
#define PWM_CANAL_ESQ    0
#define PWM_CANAL_DIR    1
#define PWM_CANAL_ARMA   2       // canal 2 usa outro timer (frequencia propria)
#define PWM_MAX          255

/* ============================================================================
 * AJUSTES - altere aqui na hora do teste / competicao
 * ==========================================================================*/

// ---- Rodas ----
int ZONA_MORTA          = 50;     // zona morta do analogico (0..512)
int VELOCIDADE_MINIMA   = 100;    // PWM minimo das rodas ao sair da zona morta
float TRIM_ESQUERDO     = 1.00f;  // compensa diferenca entre motores
float TRIM_DIREITO      = 1.00f;

// ---- Arma ----
bool ARMA_HABILITADA         = true;  // false = arma nunca liga (teste so rodas)
int  ARMA_PWM_MIN            = 70;    // duty minimo para o motor comecar a girar
int  ARMA_PWM_MAX            = 120;   // limite de velocidade (reduza p/ 1o teste)
int  ARMA_PWM_INICIO         = 40;    // de onde a rampa comeca ao ligar
int  ARMA_RAMPA_PASSO        = 3;     // quanto o duty sobe a cada passo
int  ARMA_RAMPA_INTERVALO_MS = 20;    // tempo entre passos
// Tempo ate o maximo ~= (ARMA_PWM_MAX - ARMA_PWM_INICIO) / PASSO * INTERVALO
// Com os valores acima: (255-40)/3*20 ~= 1,4 s

// ---- Bluetooth ----
int R2_ZONA_MORTA = 40;               // gatilho R2 vai de 0 a 1023

// ---- WiFi ----
const char* WIFI_NOME  = "BlackWidow";
const char* WIFI_SENHA = "blackwidow123";  // minimo 8 caracteres
int RODAS_VEL_WIFI_PCT = 70;          // valor inicial do slider das rodas (%)
int ARMA_VEL_WIFI_PCT  = 50;          // valor inicial do slider da arma (%)

// ---- Seguranca ----
uint32_t TIMEOUT_WATCHDOG_MS = 1000;  // Bluetooth: sem dados -> para tudo
uint32_t TIMEOUT_WIFI_MS     = 1500;  // WiFi: sem comandos -> para tudo

// ---- Debug ----
bool DEBUG_SERIAL = false;            // true = imprime eixos/gatilho no Serial

/* ============================================================================
 * ESTADO INTERNO
 * ==========================================================================*/

uint8_t velocidadeAtual = 180;

uint8_t  armaDutyAtual   = 0;
uint8_t  armaDutyAlvo    = 0;
uint32_t armaUltimoPasso = 0;
bool     armaEnLigado    = false;

enum Comando {
  CMD_FRENTE,
  CMD_TRAS,
  CMD_ESQUERDA,
  CMD_DIREITA,
  CMD_PARAR,
  CMD_FREAR
};

Comando comandoAtual = CMD_PARAR;

#if MODO_CONTROLE == MODO_BLUETOOTH
  ControllerPtr meuControle = nullptr;
  uint32_t ultimoPacoteControle = 0;
  bool watchdogAtivo = true;
  bool r2LiberadoDesdeConexao = false;
#elif MODO_CONTROLE == MODO_WIFI
  WebServer servidor(80);
  uint32_t ultimoComandoWifi = 0;
  bool wifiRecebendo = false;
  bool armaWifiBloqueada = true;   // exige "desligado" antes de aceitar "ligado"
#endif

/* ============================================================================
 * CAMADA PWM
 * ==========================================================================*/

#if defined(ESP_ARDUINO_VERSION_MAJOR) && \
    (ESP_ARDUINO_VERSION_MAJOR >= 3)

  // Arduino-ESP32 Core 3.x
  static bool pwmInit(uint8_t pino, uint8_t canal, uint32_t freq) {
    (void)canal;
    return ledcAttach(pino, freq, PWM_RESOLUCAO);
  }

  static void pwmEscrever(uint8_t pino, uint8_t canal, uint32_t duty) {
    (void)canal;
    ledcWrite(pino, duty);
  }

#else

  // Arduino-ESP32 Core 2.x
  static bool pwmInit(uint8_t pino, uint8_t canal, uint32_t freq) {
    ledcSetup(canal, freq, PWM_RESOLUCAO);
    ledcAttachPin(pino, canal);
    return true;
  }

  static void pwmEscrever(uint8_t pino, uint8_t canal, uint32_t duty) {
    (void)pino;
    ledcWrite(canal, duty);
  }

#endif

/* ============================================================================
 * CAMADA DE MOTORES (RODAS)
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

static uint8_t pwmEsq() {
  int valor = (int)(velocidadeAtual * TRIM_ESQUERDO);
  return (uint8_t)constrain(valor, 0, PWM_MAX);
}

static uint8_t pwmDir() {
  int valor = (int)(velocidadeAtual * TRIM_DIREITO);
  return (uint8_t)constrain(valor, 0, PWM_MAX);
}

void parar() {
  acionarMotorEsq(false, false, 0);
  acionarMotorDir(false, false, 0);
}

void frear() {
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
    case CMD_FRENTE:   frente();        break;
    case CMD_TRAS:     tras();          break;
    case CMD_ESQUERDA: girarEsquerda(); break;
    case CMD_DIREITA:  girarDireita();  break;
    case CMD_PARAR:    parar();         break;
    case CMD_FREAR:    frear();         break;
  }
}

// Converte a intensidade (ZONA_MORTA..512) em PWM das rodas.
static uint8_t intensidadeParaPwm(int intensidade) {
  intensidade = constrain(intensidade, ZONA_MORTA, 512);
  return (uint8_t)constrain(
    map(intensidade, ZONA_MORTA, 512, VELOCIDADE_MINIMA, PWM_MAX),
    VELOCIDADE_MINIMA, PWM_MAX
  );
}

// Logica de movimento usada pelos DOIS modos.
// x, y: -512..512 (y negativo = frente). freio: prioridade maxima.
void aplicarMovimento(int x, int y, bool freio) {
  if (freio) {
    receberComando(CMD_FREAR);
  }
  else if (y < -ZONA_MORTA) {
    velocidadeAtual = intensidadeParaPwm(abs(y));
    receberComando(CMD_FRENTE);
  }
  else if (y > ZONA_MORTA) {
    velocidadeAtual = intensidadeParaPwm(y);
    receberComando(CMD_TRAS);
  }
  else if (x < -ZONA_MORTA) {
    velocidadeAtual = intensidadeParaPwm(abs(x));
    receberComando(CMD_ESQUERDA);
  }
  else if (x > ZONA_MORTA) {
    velocidadeAtual = intensidadeParaPwm(x);
    receberComando(CMD_DIREITA);
  }
  else {
    velocidadeAtual = 180;
    receberComando(CMD_PARAR);
  }
}

/* ============================================================================
 * CAMADA DA ARMA (BTS7960)
 * ==========================================================================*/

// Corta a arma na hora: PWM zero e EN desligado (motor em roda livre).
void armaDesligarImediato() {
  armaDutyAlvo  = 0;
  armaDutyAtual = 0;
  pwmEscrever(PIN_ARMA_PWM, PWM_CANAL_ARMA, 0);
  digitalWrite(PIN_ARMA_EN, LOW);
  armaEnLigado = false;
}

// Define a velocidade desejada. A rampa leva o motor ate ela aos poucos.
void armaDefinirAlvo(int alvo) {
  if (!ARMA_HABILITADA) alvo = 0;
  armaDutyAlvo = (uint8_t)constrain(alvo, 0, ARMA_PWM_MAX);
}

// Chamada a cada volta do loop: aplica a rampa de aceleracao.
void armaAtualizar() {
  // Alvo zero: desliga na hora (sem frenagem, disco para sozinho).
  if (armaDutyAlvo == 0) {
    if (armaDutyAtual != 0 || armaEnLigado) {
      armaDesligarImediato();
    }
    return;
  }

  // Reducao de velocidade: aplica direto.
  if (armaDutyAlvo < armaDutyAtual) {
    armaDutyAtual = armaDutyAlvo;
    pwmEscrever(PIN_ARMA_PWM, PWM_CANAL_ARMA, armaDutyAtual);
    return;
  }

  // Aceleracao: sobe aos poucos.
  if (armaDutyAtual < armaDutyAlvo &&
      (uint32_t)(millis() - armaUltimoPasso) >=
      (uint32_t)ARMA_RAMPA_INTERVALO_MS) {

    armaUltimoPasso = millis();

    int novo;
    if (armaDutyAtual == 0) {
      novo = ARMA_PWM_INICIO;
    } else {
      novo = armaDutyAtual + ARMA_RAMPA_PASSO;
    }
    armaDutyAtual = (uint8_t)constrain(novo, 0, armaDutyAlvo);

    if (!armaEnLigado) {
      digitalWrite(PIN_ARMA_EN, HIGH);
      armaEnLigado = true;
    }
    pwmEscrever(PIN_ARMA_PWM, PWM_CANAL_ARMA, armaDutyAtual);
  }
}

// Converte uma porcentagem (1..100) em duty da arma.
static int armaPctParaDuty(int pct) {
  pct = constrain(pct, 0, 100);
  if (pct == 0) return 0;
  return map(pct, 1, 100, ARMA_PWM_MIN, ARMA_PWM_MAX);
}

// Para rodas e arma de uma vez.
void pararTudo() {
  parar();
  armaDesligarImediato();
}

/* ============================================================================
 * MODO BLUETOOTH (PS5 / Bluepad32)
 * ==========================================================================*/

#if MODO_CONTROLE == MODO_BLUETOOTH

// Converte o gatilho R2 (0..1023) em duty da arma.
static int armaDutyDoGatilho(int r2) {
  if (r2 <= R2_ZONA_MORTA) return 0;
  return map(constrain(r2, R2_ZONA_MORTA, 1023),
             R2_ZONA_MORTA, 1023, ARMA_PWM_MIN, ARMA_PWM_MAX);
}

void onConnectedController(ControllerPtr ctl) {
  if (meuControle == nullptr && ctl->isGamepad()) {
    meuControle = ctl;

    pararTudo();
    r2LiberadoDesdeConexao = false;   // exige R2 solto antes de armar

    ultimoPacoteControle = millis();
    watchdogAtivo = false;

    Serial.println();
    Serial.println("[SUCESSO] Controle conectado ao Black Widow!");
    Serial.println("[INFO] Solte o R2 para liberar a arma.");
  }
}

void onDisconnectedController(ControllerPtr ctl) {
  if (meuControle == ctl) {
    pararTudo();

    meuControle = nullptr;
    watchdogAtivo = true;

    Serial.println();
    Serial.println("[AVISO] Controle desconectado!");
    Serial.println("[SEGURANCA] Rodas e arma desligadas.");
  }
}

void processarControleBT() {
  if (meuControle == nullptr || !meuControle->isConnected()) {
    pararTudo();
    return;
  }

  int  joystickY = meuControle->axisY();
  int  joystickX = meuControle->axisX();
  bool botaoQuadrado = meuControle->x();   // x() = Quadrado no DualSense
  int  gatilhoR2 = meuControle->throttle(); // 0..1023

  if (DEBUG_SERIAL) {
    Serial.printf("X=%d | Y=%d | Quadrado=%d | R2=%d | Arma=%d\n",
                  joystickX, joystickY, botaoQuadrado,
                  gatilhoR2, armaDutyAtual);
  }

  // Rodas
  aplicarMovimento(joystickX, joystickY, botaoQuadrado);

  // Arma: trava ate o R2 ser visto solto apos a conexao.
  if (!r2LiberadoDesdeConexao) {
    if (gatilhoR2 <= R2_ZONA_MORTA) {
      r2LiberadoDesdeConexao = true;
      Serial.println("[ARMA] Gatilho liberado.");
    }
    armaDefinirAlvo(0);
    return;
  }

  armaDefinirAlvo(armaDutyDoGatilho(gatilhoR2));
}

#endif

/* ============================================================================
 * MODO WIFI (pagina web)
 * ==========================================================================*/

#if MODO_CONTROLE == MODO_WIFI

const char PAGINA_HTML[] PROGMEM = R"rawliteral(
<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>Black Widow</title>
<style>
  *{box-sizing:border-box;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  body{margin:0;font-family:system-ui,sans-serif;background:#111;color:#eee;
       display:flex;flex-direction:column;align-items:center;padding:16px;gap:16px}
  h1{margin:0;font-size:20px;letter-spacing:2px;color:#e33}
  #st{font-size:14px;color:#aaa}
  .pad{display:grid;grid-template-columns:repeat(3,80px);grid-template-rows:repeat(3,80px);gap:8px}
  .b{border:none;border-radius:12px;background:#333;color:#eee;font-size:28px;touch-action:none}
  .b.on{background:#e33}
  .freio{font-size:14px;font-weight:bold}
  .arma{width:260px;height:70px;border:none;border-radius:14px;font-size:20px;
        font-weight:bold;background:#444;color:#eee}
  .arma.ligada{background:#e33;color:#fff}
  .sl{width:260px}
  .sl label{display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px}
  .sl input{width:100%}
</style>
</head>
<body>
  <h1>BLACK WIDOW</h1>
  <div id="st">Conectando...</div>

  <div class="pad">
    <div></div><button class="b" data-d="F">&#9650;</button><div></div>
    <button class="b" data-d="E">&#9664;</button>
    <button class="b freio" data-d="B">FREIO</button>
    <button class="b" data-d="D">&#9654;</button>
    <div></div><button class="b" data-d="T">&#9660;</button><div></div>
  </div>

  <div class="sl"><label>Rodas <span id="vrv"></span></label>
    <input id="vr" type="range" min="0" max="100" value="{{VR}}"></div>

  <button id="arma" class="arma">ARMA: DESLIGADA</button>

  <div class="sl"><label>Velocidade da arma <span id="vav"></span></label>
    <input id="va" type="range" min="0" max="100" value="{{VA}}"></div>

<script>
  let d = 'P', a = 0, falhas = 0;
  const vr = document.getElementById('vr'), va = document.getElementById('va');
  const st = document.getElementById('st'), ba = document.getElementById('arma');

  function rotulos(){
    document.getElementById('vrv').textContent = vr.value + '%';
    document.getElementById('vav').textContent = va.value + '%';
  }
  vr.oninput = rotulos; va.oninput = rotulos; rotulos();

  document.querySelectorAll('[data-d]').forEach(b => {
    const on  = e => { e.preventDefault(); d = b.dataset.d; b.classList.add('on'); };
    const off = () => { d = 'P'; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    ['pointerup','pointerleave','pointercancel'].forEach(ev => b.addEventListener(ev, off));
  });

  function ui(){
    ba.textContent = a ? 'ARMA: LIGADA' : 'ARMA: DESLIGADA';
    ba.className = a ? 'arma ligada' : 'arma';
  }
  ba.onclick = () => { a = a ? 0 : 1; ui(); };

  async function tick(){
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      const r = await fetch(`/c?d=${d}&vr=${vr.value}&a=${a}&va=${va.value}`, {signal: ctrl.signal});
      clearTimeout(t);
      const duty = parseInt(await r.text()) || 0;
      st.textContent = 'Conectado | arma girando: ' + Math.round(duty * 100 / 255) + '%';
      falhas = 0;
    } catch (e) {
      falhas++;
      if (falhas > 2 && a) { a = 0; ui(); }   // perdeu conexao: desliga o botao
      if (falhas >= 5) st.textContent = 'Sem conexao com o robo';
    }
    setTimeout(tick, 100);
  }
  tick();
</script>
</body>
</html>
)rawliteral";

void handleRaiz() {
  String pagina = FPSTR(PAGINA_HTML);
  pagina.replace("{{VR}}", String(RODAS_VEL_WIFI_PCT));
  pagina.replace("{{VA}}", String(ARMA_VEL_WIFI_PCT));
  servidor.send(200, "text/html", pagina);
}

// /c?d=F|T|E|D|B|P &vr=0..100 &a=0|1 &va=0..100
void handleComando() {
  ultimoComandoWifi = millis();
  wifiRecebendo = true;

  String d   = servidor.arg("d");
  int    vr  = servidor.arg("vr").toInt();
  bool   a   = servidor.arg("a") == "1";
  int    va  = servidor.arg("va").toInt();

  // Rodas: converte direcao + slider em eixos virtuais (-512..512).
  int mag = map(constrain(vr, 0, 100), 0, 100, 0, 512);
  int x = 0, y = 0;
  bool freio = false;
  char c = d.length() ? d.charAt(0) : 'P';

  switch (c) {
    case 'F': y = -mag;     break;
    case 'T': y =  mag;     break;
    case 'E': x = -mag;     break;
    case 'D': x =  mag;     break;
    case 'B': freio = true; break;
    default:                break;
  }
  aplicarMovimento(x, y, freio);

  // Arma: so aceita "ligado" depois de ter recebido "desligado".
  if (!a) armaWifiBloqueada = false;

  if (a && !armaWifiBloqueada) {
    armaDefinirAlvo(armaPctParaDuty(va));
  } else {
    armaDefinirAlvo(0);
  }

  if (DEBUG_SERIAL) {
    Serial.printf("WiFi d=%c vr=%d a=%d va=%d | arma=%d\n",
                  c, vr, a, va, armaDutyAtual);
  }

  servidor.send(200, "text/plain", String(armaDutyAtual));
}

// Qualquer outra URL (favicon.ico, etc.): responde vazio na hora para
// liberar o servidor, que atende um cliente por vez.
void handleNaoEncontrado() {
  servidor.send(204);
}

#endif

/* ============================================================================
 * SETUP
 * ==========================================================================*/

void setup() {
  // Arma desligada ANTES de qualquer outra coisa.
  pinMode(PIN_ARMA_EN, OUTPUT);
  digitalWrite(PIN_ARMA_EN, LOW);
  pinMode(PIN_ARMA_PWM, OUTPUT);
  digitalWrite(PIN_ARMA_PWM, LOW);

  Serial.begin(115200);

  pinMode(PIN_IN1, OUTPUT);
  pinMode(PIN_IN2, OUTPUT);
  pinMode(PIN_IN3, OUTPUT);
  pinMode(PIN_IN4, OUTPUT);

  digitalWrite(PIN_IN1, LOW);
  digitalWrite(PIN_IN2, LOW);
  digitalWrite(PIN_IN3, LOW);
  digitalWrite(PIN_IN4, LOW);

  bool pwmEsqOK  = pwmInit(PIN_ENA, PWM_CANAL_ESQ, PWM_FREQ_RODAS);
  bool pwmDirOK  = pwmInit(PIN_ENB, PWM_CANAL_DIR, PWM_FREQ_RODAS);
  bool pwmArmaOK = pwmInit(PIN_ARMA_PWM, PWM_CANAL_ARMA, PWM_FREQ_ARMA);

  if (!pwmEsqOK || !pwmDirOK || !pwmArmaOK) {
    Serial.println("[ERRO] Falha ao inicializar o PWM!");
    digitalWrite(PIN_ARMA_EN, LOW);
    parar();
    while (true) {
      delay(1000);
    }
  }

  pararTudo();

  Serial.println();
  Serial.println("========================================");
  Serial.println("       BLACK WIDOW V4 - INICIANDO");
  Serial.println("========================================");

#if MODO_CONTROLE == MODO_BLUETOOTH
  BP32.setup(&onConnectedController, &onDisconnectedController);
  Serial.println("[MODO] Bluetooth (controle PS5)");
  Serial.println("[INFO] Ligue o controle PS5 para conectar.");

#elif MODO_CONTROLE == MODO_WIFI
  WiFi.mode(WIFI_AP);
  WiFi.softAP(WIFI_NOME, WIFI_SENHA);

  servidor.on("/", handleRaiz);
  servidor.on("/c", handleComando);
  servidor.onNotFound(handleNaoEncontrado);
  servidor.begin();

  Serial.println("[MODO] WiFi (pagina web)");
  Serial.printf("[INFO] Rede: %s | Senha: %s\n", WIFI_NOME, WIFI_SENHA);
  Serial.print("[INFO] Abra no navegador: http://");
  Serial.println(WiFi.softAPIP());
#endif

  if (!ARMA_HABILITADA) {
    Serial.println("[ARMA] Desabilitada (ARMA_HABILITADA = false).");
  }
}

/* ============================================================================
 * LOOP PRINCIPAL
 * ==========================================================================*/

void loop() {

#if MODO_CONTROLE == MODO_BLUETOOTH

  bool dadosNovos = BP32.update();

  if (meuControle != nullptr && meuControle->isConnected()) {

    if (dadosNovos) {
      ultimoPacoteControle = millis();
      watchdogAtivo = false;
      processarControleBT();
    }

    if (!watchdogAtivo &&
        (uint32_t)(millis() - ultimoPacoteControle) >= TIMEOUT_WATCHDOG_MS) {
      pararTudo();
      watchdogAtivo = true;
      r2LiberadoDesdeConexao = false;
      Serial.println("[ALERTA] Watchdog: dados do controle interrompidos.");
    }
  }
  else {
    if (!watchdogAtivo) {
      pararTudo();
      watchdogAtivo = true;
    }
    armaDefinirAlvo(0);
  }

#elif MODO_CONTROLE == MODO_WIFI

  servidor.handleClient();

  if (wifiRecebendo &&
      (uint32_t)(millis() - ultimoComandoWifi) >= TIMEOUT_WIFI_MS) {
    pararTudo();
    wifiRecebendo = false;
    armaWifiBloqueada = true;   // so religa com novo toque no botao
    Serial.println("[ALERTA] WiFi: comandos interrompidos. Tudo desligado.");
  }

#endif

  // Rampa da arma roda sempre, independente do modo.
  armaAtualizar();

  delay(5);
}
