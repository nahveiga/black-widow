# Black Widow — Orçamento e Esquemático (Nota N1)

Universidade São Francisco — Robótica — Rev. 1.0 — 29/08/2026

---

## 1. O que tem neste pacote

| Arquivo | Para que serve |
|---|---|
| `BlackWidow_KiCad.zip` | Projeto do KiCad, editável. Contém o esquemático e a biblioteca de símbolos. |
| `Esquematico_Black_Widow.pdf` / `.png` | Diagrama de ligações elétricas, formato A3. Use o PNG no site. |
| `Modelo_Mecanico_Black_Widow.pdf` / `.png` | Vistas superior, lateral, frontal e isométrica, com cotas em mm. |
| `Orcamento_Black_Widow.xlsx` | Planilha com descrição, quantidade, preço unitário, peso em gramas e valor total. |
| `Anexos_Black_Widow.pdf` | Os três documentos acima num PDF só, para anexar no C@mpus Digital. |
| `resumo_site.txt` | Texto do resumo do projeto para a página Home (1.913 caracteres). |

---

## 2. Como abrir o projeto no KiCad

1. Descompacte o `BlackWidow_KiCad.zip` em uma pasta qualquer do seu PC.
2. Abra o KiCad e vá em **Arquivo → Abrir projeto**, selecionando o `BlackWidow.kicad_pro`.
3. Clique em **Editor esquemático**. O esquemático abre com todos os componentes já ligados.

A biblioteca de símbolos já vem vinculada. Isso funciona porque o arquivo `sym-lib-table`, que vai junto na pasta, aponta para `${KIPRJMOD}/bibliotecas/BlackWidow.kicad_sym`. A variável `${KIPRJMOD}` significa "a pasta deste projeto", então o caminho não quebra mesmo que você mova a pasta de lugar ou abra em outro computador.

Se quiser conferir a coerência elétrica, use a ferramenta **ERC** (Verificação de Regras Elétricas) na barra do Editor Esquemático. Os pinos não usados do ESP32 já foram marcados com o símbolo de "sem conexão", então o ERC não deve acusar erros.

---

## 3. Mapa de pinos do ESP32

Esta é a tabela que a pessoa que for programar vai precisar.

| Sinal | Pino do ESP32 | Ligado a | Função |
|---|---|---|---|
| RPWM_A | GPIO25 | Ponte H M1, pino RPWM | PWM giro à frente, motor esquerdo |
| LPWM_A | GPIO26 | Ponte H M1, pino LPWM | PWM giro à ré, motor esquerdo |
| EN_A | GPIO27 | Ponte H M1, pinos R_EN e L_EN | Habilita o motor esquerdo |
| RPWM_B | GPIO32 | Ponte H M2, pino RPWM | PWM giro à frente, motor direito |
| LPWM_B | GPIO33 | Ponte H M2, pino LPWM | PWM giro à ré, motor direito |
| EN_B | GPIO14 | Ponte H M2, pinos R_EN e L_EN | Habilita o motor direito |
| ENC_A_A | GPIO34 | Encoder motor A, canal A | Leitura de velocidade |
| ENC_A_B | GPIO35 | Encoder motor A, canal B | Leitura de sentido |
| ENC_B_A | GPIO36 | Encoder motor B, canal A | Leitura de velocidade |
| ENC_B_B | GPIO39 | Encoder motor B, canal B | Leitura de sentido |
| VIN | VIN | Saída de 5 V do LM2596 | Alimentação da placa |
| 3V3 | 3.3V (saída) | Alimentação dos encoders | Referência de 3,3 V |
| GND | GND | Terra comum | Referência de sinal |

Por que os encoders foram para GPIO34, 35, 36 e 39: esses quatro pinos do ESP32 são **input-only**, ou seja, só funcionam como entrada, nunca como saída. Isso os torna inúteis para acionar coisas, mas perfeitos para ler sensores — assim os pinos que podem ser saída ficam livres para outras funções.

---

## 4. Três decisões técnicas que mudam o que estava combinado no grupo

**4.1. São necessárias 2 pontes H, não 1.**
O módulo BTS7960 é uma ponte H completa para **um** motor. Ele consegue girar esse motor nos dois sentidos, mas atende só a um. Com 2 motores, são 2 módulos. A lista original previa 1 unidade.

**4.2. O conversor abaixa 12 V para 5 V, e não 5 V para 3,3 V.**
No grupo ficou registrado que "na ponte H tem um pino que sai de 5 V e o conversor transforma em 3,3 V". O BTS7960 **recebe** 5 V para alimentar a lógica interna, ele não fornece essa tensão. O papel do LM2596 é pegar os 12 V da bateria e entregar 5 V para a lógica das pontes e para o pino VIN do ESP32, que tem regulador interno próprio para 3,3 V.

**4.3. Os encoders são alimentados em 3,3 V, não em 5 V.**
Este é o ponto mais crítico do projeto. Os GPIOs do ESP32 **não toleram 5 V**. Se o encoder for alimentado com 5 V, os pulsos que ele devolve saem em 5 V e vão direto para o pino do microcontrolador, danificando a placa. Alimentando o encoder pelo pino de saída 3,3 V do próprio ESP32, os pulsos já saem no nível seguro.

Além disso, o encoder saiu da planilha como item separado: o motor JGB37-520 já é vendido com encoder de quadratura acoplado. Comprá-lo à parte seria pagar duas vezes pela mesma função. Essa correção sozinha liberou R$ 250,00 do orçamento.

---

## 5. Resumo do dimensionamento

| Item | Valor |
|---|---|
| Chassi | 280 x 190 x 80 mm |
| Largura total com rodas | 244 mm |
| Vão livre do solo | 8 mm |
| Rodas motrizes | 65 mm de diâmetro, 27 mm de largura |
| Ângulo da rampa | aproximadamente 24 graus |
| Massa total estimada | 2,704 kg |
| Custo total | R$ 1.025,00 (teto de R$ 1.200,00, margem de R$ 175,00) |

---

## 6. O que ainda depende de decisão do grupo

1. **Material definitivo da rampa.** Está orçada chapa de aço 1,5 mm. Aço é mais resistente; alumínio seria mais leve. Como sobrou margem de R$ 175, dá para escolher com folga.
2. **Chassi montado versus kit pronto.** O orçamento assume chapas de alumínio cortadas. O kit 2WD de R$ 67 que apareceu no grupo é bem mais barato, mas é de acrílico e vem com motores menores, sem torque para robô de combate. A troca só compensa se o objetivo for entregar rápido e depois melhorar.
3. **Capacidade real da bateria.** 6 Ah é uma estimativa. Depois de medir o consumo dos motores em teste, esse número pode cair, o que reduz peso e custo.
4. **Nomes completos e RAs dos integrantes** e a indicação de quem é o capitão — obrigatórios na página Home e não constam nas conversas.

---

## 7. Checklist da entrega

- [ ] Publicar página **Home**: nome do robô, integrantes com RA, capitão, e o texto do `resumo_site.txt`
- [ ] Publicar página **Orçamento e Esquemático**: planilha + as duas imagens PNG
- [ ] Gerar o PDF consolidado das duas páginas do site
- [ ] Anexar no C@mpus Digital: PDF do site + `Anexos_Black_Widow.pdf` + `Orcamento_Black_Widow.xlsx`
