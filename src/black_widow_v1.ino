/* ============================================================================
 *  BLACK WIDOW - V1
 *  Robô de combate com tração diferencial controlado por navegador via Wi-Fi.
 *
 *  CORE ARDUINO-ESP32 ASSUMIDA: 2.x  (ledcSetup / ledcAttachPin / ledcWrite)
 *  O código também compila na core 3.x: há um bloco de compatibilidade que
 *  troca automaticamente para a API nova (ledcAttach / ledcWrite por pino)
 *  usando a macro ESP_ARDUINO_VERSION_MAJOR. Nunca usamos analogWrite.
 *
 *  ARQUITETURA (importante para a V2):
 *    [ origem do comando ] -> receberComando(Comando) -> [ funções de motor ]
 *         HTTP (V1)              camada isolada          frente/tras/girar...
 *         Bluetooth (V2)
 *  Para a V2 basta chamar receberComando() a partir do serial Bluetooth.
 *  Nada abaixo dessa camada precisa mudar.
 *
 *  IDE: o arquivo precisa estar numa pasta com o MESMO nome
 *       (black_widow_v1/black_widow_v1.ino) para a Arduino IDE abrir.
 * ==========================================================================*/

#include <WiFi.h>
#include <WebServer.h>

/* ============================================================================
 *  PINAGEM - fixa, definida pelo hardware já montado (ponte H dupla L298N)
 *  Lógica do L298N: EN* recebe PWM (habilita e dosa o canal),
 *                   IN* definem o sentido de rotação.
 * ==========================================================================*/

/* ---- MOTOR ESQUERDO ---- */
#define PIN_ENA   13   // PWM do canal A (velocidade da roda esquerda)
#define PIN_IN1   12   // sentido A1  << PINO DE STRAPPING (MTDI) - ver setup()
#define PIN_IN2   14   // sentido A2

/* ---- MOTOR DIREITO ---- */
#define PIN_ENB   25   // PWM do canal B (velocidade da roda direita)
#define PIN_IN3   27   // sentido B1
#define PIN_IN4   26   // sentido B2

/* ============================================================================
 *  PWM (LEDC)
 *  1000 Hz é um bom compromisso para motor DC com redução: alto o bastante
 *  para não virar um chiado grosseiro e baixo o bastante para a ponte H
 *  (o L298N é lento; acima de poucos kHz ele perde eficiência e esquenta).
 *  8 bits => faixa 0-255, a mesma escala do slider da interface.
 * ==========================================================================*/
#define PWM_FREQ        1000
#define PWM_RESOLUCAO   8
#define PWM_CANAL_ESQ   0    // ENA e ENB em canais LEDC DISTINTOS, senão as
#define PWM_CANAL_DIR   1    // duas rodas dividiriam o mesmo duty cycle.
#define PWM_MAX         255

/* ============================================================================
 *  REDE - Access Point próprio (não depende de roteador nem de internet)
 * ==========================================================================*/
#define AP_SSID   "BLACKWINDOW"
#define AP_SENHA  "12345678"     // WPA2 exige no mínimo 8 caracteres

/* ============================================================================
 *  SEGURANÇA
 *  Se o Wi-Fi cair, o celular travar ou o evento de "soltar o botão" não
 *  disparar (acontece muito em touch), o robô NÃO pode continuar acelerando.
 *  A interface reenvia o comando a cada 150 ms enquanto o botão está
 *  pressionado; se 400 ms passarem sem nada chegar, cortamos os motores.
 * ==========================================================================*/
#define TIMEOUT_WATCHDOG_MS  400

/* ============================================================================
 *  TRIM - compensação mecânica por motor
 *  Sem encoder não há como medir a rotação real. Motores DC baratos nunca são
 *  iguais: mesmo duty cycle, rotações diferentes => o robô puxa para um lado.
 *  O trim é um multiplicador (0.0 a 1.0) aplicado ao lado MAIS RÁPIDO para
 *  igualar os dois. Ajuste empiricamente: se ele puxa para a direita, o motor
 *  esquerdo está mais rápido -> reduza TRIM_ESQUERDO (ex.: 0.92).
 * ==========================================================================*/
float TRIM_ESQUERDO = 1.00f;
float TRIM_DIREITO  = 1.00f;

/* ============================================================================
 *  ESTADO GLOBAL
 * ==========================================================================*/
WebServer servidor(80);

uint8_t  velocidadeAtual    = 180;   // 0-255, controlada pelo slider
uint32_t millisUltimoCmd    = 0;     // carimbo de tempo do último comando
bool     paradoPeloWatchdog = true;  // evita reescrever os pinos a cada loop
const char* nomeUltimoComando = "PARADO";

/* Camada de comando: a origem (HTTP hoje, Bluetooth na V2) só conhece estes
   símbolos. Nenhuma origem de comando toca em GPIO diretamente. */
enum Comando {
  CMD_FRENTE,
  CMD_TRAS,
  CMD_ESQUERDA,
  CMD_DIREITA,
  CMD_PARAR,
  CMD_FREAR
};

Comando comandoAtual = CMD_PARAR;   // usado para reaplicar o PWM ao mexer no slider

/* ============================================================================
 *  CAMADA DE PWM - isola a diferença entre a core 2.x e a 3.x
 * ==========================================================================*/
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
  /* Core 3.x: o canal é escolhido internamente, tudo é endereçado pelo pino. */
  static inline void pwmInit(uint8_t pino, uint8_t canal) {
    (void)canal;
    ledcAttach(pino, PWM_FREQ, PWM_RESOLUCAO);
  }
  static inline void pwmEscrever(uint8_t pino, uint8_t canal, uint32_t duty) {
    (void)canal;
    ledcWrite(pino, duty);
  }
#else
  /* Core 2.x: configura o canal, amarra o pino ao canal, escreve no canal. */
  static inline void pwmInit(uint8_t pino, uint8_t canal) {
    ledcSetup(canal, PWM_FREQ, PWM_RESOLUCAO);
    ledcAttachPin(pino, canal);
  }
  static inline void pwmEscrever(uint8_t pino, uint8_t canal, uint32_t duty) {
    (void)pino;
    ledcWrite(canal, duty);
  }
#endif

/* ============================================================================
 *  CAMADA DE MOTOR - a única parte que fala com o hardware
 * ==========================================================================*/

/* Aplica sentido + PWM a um lado. Centralizar aqui garante que sentido e
   velocidade sempre mudem juntos, sem estado intermediário estranho. */
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

/* Velocidade efetiva de cada lado = velocidade global * trim daquele lado. */
static uint8_t pwmEsq() {
  int v = (int)(velocidadeAtual * TRIM_ESQUERDO);
  return (uint8_t)constrain(v, 0, PWM_MAX);
}
static uint8_t pwmDir() {
  int v = (int)(velocidadeAtual * TRIM_DIREITO);
  return (uint8_t)constrain(v, 0, PWM_MAX);
}

void frente() {
  acionarMotorEsq(true, false, pwmEsq());
  acionarMotorDir(true, false, pwmDir());
}

void tras() {
  acionarMotorEsq(false, true, pwmEsq());
  acionarMotorDir(false, true, pwmDir());
}

/* Giro no próprio eixo: rodas em sentidos OPOSTOS.
   Esquerda = roda esquerda para trás, roda direita para frente. */
void girarEsquerda() {
  acionarMotorEsq(false, true, pwmEsq());
  acionarMotorDir(true, false, pwmDir());
}

void girarDireita() {
  acionarMotorEsq(true, false, pwmEsq());
  acionarMotorDir(false, true, pwmDir());
}

/* PARAR = roda livre (coast). Todos os IN em LOW e PWM zerado: a ponte H
   solta os terminais do motor e ele para por inércia/atrito. */
void parar() {
  acionarMotorEsq(false, false, 0);
  acionarMotorDir(false, false, 0);
}

/* FREAR = frenagem ativa (brake). Os dois IN do mesmo canal no MESMO nível
   curto-circuitam os terminais do motor através da ponte; a força
   contra-eletromotriz vira corrente de frenagem. PWM em 255 mantém o canal
   habilitado durante o curto. Só faz sentido por instantes - o watchdog
   solta para parar() depois de 400 ms, o que também protege a ponte H. */
void frear() {
  acionarMotorEsq(true, true, PWM_MAX);
  acionarMotorDir(true, true, PWM_MAX);
}

/* ============================================================================
 *  CAMADA DE COMANDO - ponto único de entrada
 *  Qualquer origem (HTTP agora, Bluetooth na V2) chama SÓ esta função.
 *  Ela é quem alimenta o watchdog e registra o estado exposto no /status.
 * ==========================================================================*/
void receberComando(Comando cmd) {
  millisUltimoCmd = millis();
  paradoPeloWatchdog = false;
  comandoAtual = cmd;

  switch (cmd) {
    case CMD_FRENTE:   frente();        nomeUltimoComando = "FRENTE";   break;
    case CMD_TRAS:     tras();          nomeUltimoComando = "TRAS";     break;
    case CMD_ESQUERDA: girarEsquerda(); nomeUltimoComando = "ESQUERDA"; break;
    case CMD_DIREITA:  girarDireita();  nomeUltimoComando = "DIREITA";  break;
    case CMD_FREAR:    frear();         nomeUltimoComando = "FREANDO";  break;
    case CMD_PARAR:
    default:
      parar();
      nomeUltimoComando = "PARADO";
      /* Um PARAR explícito já deixou tudo desligado: marcamos como tratado
         para o watchdog não precisar reescrever os pinos depois. */
      paradoPeloWatchdog = true;
      break;
  }
}

/* Ajuste de velocidade NÃO alimenta o watchdog: mexer no slider não é um
   comando de movimento. Mas reaplicamos o comando em curso para o novo PWM
   valer na hora, sem precisar soltar e apertar o botão de novo. */
void definirVelocidade(int valor) {
  velocidadeAtual = (uint8_t)constrain(valor, 0, PWM_MAX);
  if (!paradoPeloWatchdog) {
    switch (comandoAtual) {
      case CMD_FRENTE:   frente();        break;
      case CMD_TRAS:     tras();          break;
      case CMD_ESQUERDA: girarEsquerda(); break;
      case CMD_DIREITA:  girarDireita();  break;
      default: break;   // FREAR e PARAR não dependem do slider
    }
  }
}

/* ============================================================================
 *  INTERFACE WEB - HTML/CSS/JS embutidos em PROGMEM
 *  Tudo inline: o celular fica conectado ao AP do robô, SEM internet, então
 *  nenhum recurso externo (CDN, fonte, ícone) pode ser referenciado.
 * ==========================================================================*/
const char PAGINA_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<!-- user-scalable=no: um duplo-toque acidental no meio do combate não pode
     dar zoom e desalinhar os botões do grid -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>BLACK WIDOW</title>
<style>
  :root{
    --bg:#0d0d10; --painel:#17171d; --borda:#2c2c36;
    --texto:#e8e8ef; --apagado:#8a8a99;
    --acento:#c8102e; --ok:#26c281; --off:#e04b4b;
  }
  *{box-sizing:border-box; -webkit-tap-highlight-color:transparent;}
  html,body{height:100%;}
  body{
    margin:0; background:var(--bg); color:var(--texto);
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    display:flex; flex-direction:column; gap:12px;
    padding:12px; overflow:hidden;
    /* touch-action:none impede o navegador de tratar o arrasto sobre o
       controle como scroll ou pull-to-refresh */
    touch-action:none; user-select:none; -webkit-user-select:none;
  }
  header{display:flex; align-items:center; justify-content:space-between;}
  h1{margin:0; font-size:17px; letter-spacing:3px; font-weight:700;}
  h1 span{color:var(--acento);}

  .status{display:flex; align-items:center; gap:8px; font-size:12px; color:var(--apagado);}
  #led{width:10px; height:10px; border-radius:50%; background:var(--off);}
  #led.on{background:var(--ok);}

  .painel{
    background:var(--painel); border:1px solid var(--borda);
    border-radius:12px; padding:10px 12px;
  }
  .linha{display:flex; align-items:center; justify-content:space-between; gap:10px;}
  .rotulo{font-size:11px; color:var(--apagado); letter-spacing:1px;}
  #cmd{font-size:15px; font-weight:700; letter-spacing:2px;}

  input[type=range]{
    -webkit-appearance:none; appearance:none;
    width:100%; height:28px; background:transparent; margin:4px 0 0 0;
  }
  input[type=range]::-webkit-slider-runnable-track{height:8px;border-radius:4px;background:#33333f;}
  input[type=range]::-webkit-slider-thumb{
    -webkit-appearance:none; width:28px; height:28px; margin-top:-10px;
    border-radius:50%; background:var(--acento); border:2px solid #fff;
  }
  input[type=range]::-moz-range-track{height:8px;border-radius:4px;background:#33333f;}
  input[type=range]::-moz-range-thumb{
    width:26px;height:26px;border-radius:50%;background:var(--acento);border:2px solid #fff;
  }
  #vel{
    min-width:52px; text-align:right; font-variant-numeric:tabular-nums;
    font-size:20px; font-weight:700; color:var(--acento);
  }

  /* Grid 3x3: as setas ocupam as bordas, PARAR fica no centro */
  .grid{
    flex:1; display:grid; gap:10px;
    grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr);
    min-height:0;
  }
  .btn{
    display:flex; align-items:center; justify-content:center;
    background:var(--painel); border:1px solid var(--borda); border-radius:14px;
    color:var(--texto); font-size:34px; line-height:1;
    touch-action:none; user-select:none; cursor:pointer;
  }
  .btn:active,.btn.ativo{background:var(--acento); border-color:var(--acento);}
  .vazio{visibility:hidden;}
  .centro{font-size:15px; font-weight:700; letter-spacing:2px;}

  #emergencia{
    padding:20px; border:none; border-radius:14px;
    background:var(--acento); color:#fff;
    font-size:18px; font-weight:800; letter-spacing:3px;
    touch-action:none; cursor:pointer;
  }
  #emergencia:active{background:#8d0b20;}
</style>
</head>
<body>

<header>
  <h1>BLACK <span>WIDOW</span></h1>
  <div class="status"><div id="led"></div><span id="conn">conectando</span></div>
</header>

<div class="painel">
  <div class="linha"><span class="rotulo">ULTIMO COMANDO</span><span id="cmd">--</span></div>
</div>

<div class="painel">
  <div class="linha">
    <span class="rotulo">VELOCIDADE</span>
    <span id="vel">180</span>
  </div>
  <input type="range" id="slider" min="0" max="255" value="180">
</div>

<div class="grid">
  <div class="vazio"></div>
  <div class="btn" id="b-frente">&#9650;</div>
  <div class="vazio"></div>

  <div class="btn" id="b-esq">&#9668;</div>
  <div class="btn centro" id="b-parar">PARAR</div>
  <div class="btn" id="b-dir">&#9658;</div>

  <div class="vazio"></div>
  <div class="btn" id="b-tras">&#9660;</div>
  <div class="vazio"></div>
</div>

<button id="emergencia">PARADA DE EMERGENCIA</button>

<script>
// ---------------------------------------------------------------------------
// Envio de comandos: fetch() puro, sem recarregar a página.
// O resultado de cada requisição também serve de ping do indicador de
// conexão: se o fetch falhar, o link Wi-Fi caiu.
// ---------------------------------------------------------------------------
var led  = document.getElementById('led');
var conn = document.getElementById('conn');
var cmdLabel = document.getElementById('cmd');

function marcarConexao(ok){
  if(ok){ led.classList.add('on');    conn.textContent = 'conectado'; }
  else  { led.classList.remove('on'); conn.textContent = 'sem sinal'; }
}

function enviar(rota){
  return fetch(rota, {cache:'no-store'})
    .then(function(r){ marcarConexao(r.ok); return r; })
    .catch(function(){ marcarConexao(false); });
}

// ---------------------------------------------------------------------------
// Repetição enquanto pressionado.
// O firmware tem watchdog de 400 ms: se ficarmos calados, ele corta os
// motores. Por isso reenviamos o comando a cada 150 ms enquanto o dedo está
// no botão. É esse mecanismo que torna "anda enquanto pressionado" seguro:
// soltar o dedo, travar o app ou perder o Wi-Fi param o robô do mesmo jeito.
// ---------------------------------------------------------------------------
var repetidor = null;
var botaoAtivo = null;

function pressionar(ev, rota, elemento){
  // preventDefault: sem isso o toque vira scroll, seleção de texto, ou
  // dispara um evento de mouse duplicado logo depois do touch.
  if(ev && ev.preventDefault) ev.preventDefault();
  if(botaoAtivo === elemento) return;
  pararRepeticao();
  botaoAtivo = elemento;
  elemento.classList.add('ativo');
  cmdLabel.textContent = rota.replace('/','').toUpperCase();
  enviar(rota);
  repetidor = setInterval(function(){ enviar(rota); }, 150);
}

function pararRepeticao(){
  if(repetidor){ clearInterval(repetidor); repetidor = null; }
  if(botaoAtivo){ botaoAtivo.classList.remove('ativo'); botaoAtivo = null; }
}

function soltar(ev){
  if(ev && ev.preventDefault) ev.preventDefault();
  pararRepeticao();
  cmdLabel.textContent = 'PARADO';
  enviar('/parar');
}

function ligarBotao(id, rota){
  var el = document.getElementById(id);
  el.addEventListener('touchstart', function(e){ pressionar(e, rota, el); }, {passive:false});
  el.addEventListener('mousedown',  function(e){ pressionar(e, rota, el); });
  // touchend, touchcancel, mouseup e mouseleave: qualquer forma de "soltar"
  // precisa parar o robô. A redundância aqui é proposital.
  el.addEventListener('touchend',    function(e){ soltar(e); }, {passive:false});
  el.addEventListener('touchcancel', function(e){ soltar(e); }, {passive:false});
  el.addEventListener('mouseup',     function(e){ soltar(e); });
  el.addEventListener('mouseleave',  function(e){ if(botaoAtivo === el) soltar(e); });
  el.addEventListener('contextmenu', function(e){ e.preventDefault(); });
}

ligarBotao('b-frente', '/frente');
ligarBotao('b-tras',   '/tras');
ligarBotao('b-esq',    '/esquerda');
ligarBotao('b-dir',    '/direita');

// Botão central: parada simples, funciona no clique (não precisa segurar).
var bParar = document.getElementById('b-parar');
bParar.addEventListener('touchstart', function(e){ soltar(e); }, {passive:false});
bParar.addEventListener('mousedown',  function(e){ soltar(e); });

// Se a aba perder o foco (notificação, troca de app), soltamos tudo:
// nesse caso o dedo pode nunca gerar o touchend.
window.addEventListener('blur', function(){ if(botaoAtivo) soltar(null); });
document.addEventListener('visibilitychange', function(){
  if(document.hidden && botaoAtivo) soltar(null);
});

// ---------------------------------------------------------------------------
// Parada de emergência: freio ativo. Cancela qualquer repetição em andamento
// antes de tudo, para nenhum comando de movimento chegar depois.
// ---------------------------------------------------------------------------
document.getElementById('emergencia').addEventListener('click', function(e){
  e.preventDefault();
  pararRepeticao();
  cmdLabel.textContent = 'EMERGENCIA';
  enviar('/frear');
});

// ---------------------------------------------------------------------------
// Slider de velocidade. Enviamos no input (resposta imediata), com um
// throttle simples para não inundar o servidor single-thread do ESP32.
// ---------------------------------------------------------------------------
var slider = document.getElementById('slider');
var labelVel = document.getElementById('vel');
var ultimoEnvioVel = 0;
var pendenteVel = null;

function mandarVelocidade(v){
  enviar('/velocidade?valor=' + v);
  ultimoEnvioVel = Date.now();
}

slider.addEventListener('input', function(){
  var v = slider.value;
  labelVel.textContent = v;
  var agora = Date.now();
  if(agora - ultimoEnvioVel > 120){
    mandarVelocidade(v);
  } else {
    clearTimeout(pendenteVel);
    pendenteVel = setTimeout(function(){ mandarVelocidade(slider.value); }, 120);
  }
});
slider.addEventListener('change', function(){ mandarVelocidade(slider.value); });

// ---------------------------------------------------------------------------
// Heartbeat de status: /status NÃO alimenta o watchdog, serve só para o
// indicador saber se o robô ainda responde enquanto estamos parados.
// ---------------------------------------------------------------------------
setInterval(function(){ if(!botaoAtivo) enviar('/status'); }, 1000);
enviar('/status');
</script>
</body>
</html>
)rawliteral";

/* ============================================================================
 *  ROTAS HTTP - só traduzem URL em Comando. Nenhuma lógica de motor aqui.
 * ==========================================================================*/
void rotaRaiz()     { servidor.send_P(200, "text/html", PAGINA_HTML); }

void rotaFrente()   { receberComando(CMD_FRENTE);   servidor.send(200, "text/plain", "FRENTE"); }
void rotaTras()     { receberComando(CMD_TRAS);     servidor.send(200, "text/plain", "TRAS"); }
void rotaEsquerda() { receberComando(CMD_ESQUERDA); servidor.send(200, "text/plain", "ESQUERDA"); }
void rotaDireita()  { receberComando(CMD_DIREITA);  servidor.send(200, "text/plain", "DIREITA"); }
void rotaParar()    { receberComando(CMD_PARAR);    servidor.send(200, "text/plain", "PARADO"); }
void rotaFrear()    { receberComando(CMD_FREAR);    servidor.send(200, "text/plain", "FREANDO"); }

void rotaVelocidade() {
  if (servidor.hasArg("valor")) {
    definirVelocidade(servidor.arg("valor").toInt());
    servidor.send(200, "text/plain", String(velocidadeAtual));
  } else {
    servidor.send(400, "text/plain", "faltou o parametro 'valor'");
  }
}

void rotaStatus() {
  String s;
  s += "comando=";     s += nomeUltimoComando;
  s += " velocidade="; s += String(velocidadeAtual);
  s += " trimEsq=";    s += String(TRIM_ESQUERDO, 2);
  s += " trimDir=";    s += String(TRIM_DIREITO, 2);
  s += " msDesdeCmd="; s += String(millis() - millisUltimoCmd);
  s += " clientes=";   s += String(WiFi.softAPgetStationNum());
  servidor.send(200, "text/plain", s);
}

void rotaNaoEncontrada() {
  servidor.send(404, "text/plain", "rota inexistente");
}

/* ============================================================================
 *  SETUP
 * ==========================================================================*/
void setup() {
  /* ------------------------------------------------------------------------
   *  ORDEM CRÍTICA - GPIO 12 (IN1) é pino de STRAPPING (MTDI) do ESP32.
   *  No instante do boot o nível de MTDI define a tensão do regulador do
   *  flash (VDD_SDIO). Se estiver em nível ALTO no reset, a placa pode não
   *  inicializar / entrar em boot loop.
   *  Por isso a PRIMEIRA coisa do setup é forçar IN1 em OUTPUT/LOW, ANTES do
   *  Serial, do Wi-Fi e do servidor. Fazemos o mesmo com IN2/IN3/IN4 por
   *  consistência - e porque isso garante que os motores nasçam parados,
   *  em vez de arrancarem sozinhos durante a subida do firmware.
   * ---------------------------------------------------------------------- */
  pinMode(PIN_IN1, OUTPUT);  digitalWrite(PIN_IN1, LOW);   // GPIO12 - strapping
  pinMode(PIN_IN2, OUTPUT);  digitalWrite(PIN_IN2, LOW);
  pinMode(PIN_IN3, OUTPUT);  digitalWrite(PIN_IN3, LOW);
  pinMode(PIN_IN4, OUTPUT);  digitalWrite(PIN_IN4, LOW);

  /* Só depois configuramos o PWM dos enables, já com duty 0. */
  pwmInit(PIN_ENA, PWM_CANAL_ESQ);
  pwmInit(PIN_ENB, PWM_CANAL_DIR);
  pwmEscrever(PIN_ENA, PWM_CANAL_ESQ, 0);
  pwmEscrever(PIN_ENB, PWM_CANAL_DIR, 0);

  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println(F("=== BLACK WIDOW V1 ==="));
  Serial.println(F("Motores inicializados em estado PARADO."));

  /* ---- Access Point: o próprio robô cria a rede, sem roteador ---- */
  WiFi.mode(WIFI_AP);
  bool ok = WiFi.softAP(AP_SSID, AP_SENHA);
  Serial.print(F("AP \""));
  Serial.print(AP_SSID);
  Serial.println(ok ? F("\" criado.") : F("\" FALHOU!"));

  Serial.print(F("Conecte o celular nessa rede e abra: http://"));
  Serial.println(WiFi.softAPIP());

  /* ---- Rotas ---- */
  servidor.on("/",           HTTP_GET, rotaRaiz);
  servidor.on("/frente",     HTTP_GET, rotaFrente);
  servidor.on("/tras",       HTTP_GET, rotaTras);
  servidor.on("/esquerda",   HTTP_GET, rotaEsquerda);
  servidor.on("/direita",    HTTP_GET, rotaDireita);
  servidor.on("/parar",      HTTP_GET, rotaParar);
  servidor.on("/frear",      HTTP_GET, rotaFrear);
  servidor.on("/velocidade", HTTP_GET, rotaVelocidade);
  servidor.on("/status",     HTTP_GET, rotaStatus);
  servidor.onNotFound(rotaNaoEncontrada);

  servidor.begin();
  Serial.println(F("Servidor HTTP no ar."));

  /* Estado inicial explícito e seguro. */
  millisUltimoCmd = millis();
  receberComando(CMD_PARAR);
}

/* ============================================================================
 *  LOOP
 * ==========================================================================*/
void loop() {
  servidor.handleClient();

  /* ---- WATCHDOG DE MOVIMENTO ----
   * Nenhum comando há mais de TIMEOUT_WATCHDOG_MS => corta os motores.
   * A flag evita reescrever GPIO milhares de vezes por segundo enquanto o
   * robô já está parado. */
  if (!paradoPeloWatchdog &&
      (millis() - millisUltimoCmd) > TIMEOUT_WATCHDOG_MS) {
    parar();
    paradoPeloWatchdog = true;
    comandoAtual = CMD_PARAR;
    nomeUltimoComando = "PARADO (watchdog)";
    Serial.println(F("[watchdog] sem comandos -> motores cortados"));
  }
}
